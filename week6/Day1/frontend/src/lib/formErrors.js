export function toFieldErrors(errors = []) {
  return errors.reduce((acc, { field, message }) => {
    if (!acc[field]) acc[field] = message;
    return acc;
  }, {});
}
