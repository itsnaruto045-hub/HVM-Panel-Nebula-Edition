function validateString(s){
  return typeof s === 'string' && s.trim().length > 0 && s.length < 200;
}
module.exports = { validateString };
