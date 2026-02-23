export function notImplemented(operation) {
  return (req, res) => {
    res.status(501).json({
      code: 'NOT_IMPLEMENTED',
      message: `${operation} is scaffolded but not implemented yet`,
      path: req.path,
      method: req.method,
    });
  };
}
