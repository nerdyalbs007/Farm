const uuid = require('uuid/v4');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Product = require('../models/product');
const User = require('../models/user');

const getProductById = async (req, res, next) => {
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not find a product.',
      500
    );
    return next(error);
  }

  if (!product) {
    const error = new HttpError(
      'Could not find a product for the provided id.',
      404
    );
    return next(error);
  }

  res.json({ product: product.toObject({ getters: true }) });
};

const getProductsByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  // let products;
  let userWithProducts;
  try {
    userWithProducts = await User.findById(userId).populate('products');
  } catch (err) {
    const error = new HttpError(
      'Fetching products failed, please try again later',
      500
    );
    return next(error);
  }

  // if (!products || products.length === 0) {
  if (!userWithProducts || userWithProducts.products.length === 0) {
    return next(
      new HttpError('Could not find products for the provided user id.', 404)
    );
  }

  res.json({
    products: userWithProducts.products.map(product =>
      product.toObject({ getters: true })
    )
  });
};

const createProduct = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const { title, description, address, creator } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdProduct = new Product({
    title,
    description,
    address,
    location: coordinates,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/400px-Empire_State_Building_%28aerial_view%29.jpg',
    creator
  });

  let user;
  try {
    user = await User.findById(creator);
  } catch (err) {
    const error = new HttpError('Creating product failed, please try again', 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError('Could not find user for provided id', 404);
    return next(error);
  }

  console.log(user);

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdProduct.save({ session: sess });
    user.products.push(createdProduct);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Creating product failed, please try again.',
      500
    );
    return next(error);
  }

  res.status(201).json({ product: createdProduct });
};

const updateProduct = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const { title, description } = req.body;
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update product.',
      500
    );
    return next(error);
  }

  product.title = title;
  product.description = description;

  try {
    await product.save();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update product.',
      500
    );
    return next(error);
  }

  res.status(200).json({ product: product.toObject({ getters: true }) });
};

const deleteProduct = async (req, res, next) => {
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId).populate('creator');
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete product.',
      500
    );
    return next(error);
  }

  if (!product) {
    const error = new HttpError('Could not find product for this id.', 404);
    return next(error);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await product.remove({ session: sess });
    product.creator.products.pull(product);
    await product.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete product.',
      500
    );
    return next(error);
  }

  res.status(200).json({ message: 'Deleted product.' });
};

exports.getProductById = getProductById;
exports.getProductsByUserId = getProductsByUserId;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;