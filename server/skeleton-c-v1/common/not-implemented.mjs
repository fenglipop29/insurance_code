export function notImplemented(operation) {
  return (_req, res) => {
    res.status(501).json({
      code: 'NOT_IMPLEMENTED',
      message: `${operation} is scaffolded but not implemented yet`,
    });
  };
}
