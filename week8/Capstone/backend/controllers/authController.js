const User = require("../models/User");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
    const {  name, email, password, } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ message: "Email already registered"});
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

const me = (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

const logout = (req, res) => {
  res.json({ message: "Logged out successfully" });
};



module.exports = { register, login, me, logout };