// my-vue-project/api/ping.js
module.exports = (req, res) => {
  res.status(200).json({
    status: 1,
    message: 'ping ok',
    query: req.query,
  });
};
