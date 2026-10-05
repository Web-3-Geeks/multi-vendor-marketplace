const errorHandler = (err, req, res, next) => {
    if (err.code === 11000) {
        return res.status(409).json({ message: "Email already registered" });
    }

    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? "Internal server error" : err.message;

    if (statusCode === 500) console.error(err);

    res.status(statusCode).json({ message });
};

module.exports = errorHandler;