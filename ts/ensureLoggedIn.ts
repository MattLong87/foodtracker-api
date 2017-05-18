  export default function(req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({message: "Not Logged In"});
    }
    next();
  }