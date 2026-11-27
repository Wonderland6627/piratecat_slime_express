/**
 * 将异步控制器的 rejected Promise 交给 Express 错误处理中间件。
 * Express 4 不会自动捕获 async 函数异常，所以路由应使用 asyncHandler(controller)。
 * @param {Function} handler
 * @returns {Function}
 */
function asyncHandler(handler) {
  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
