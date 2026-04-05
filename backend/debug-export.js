import translatePkg from 'google-translate-api-next';
console.log('Type of translatePkg:', typeof translatePkg);
console.log('Keys of translatePkg:', Object.keys(translatePkg || {}));
if (typeof translatePkg === 'function') {
  console.log('translatePkg IS a function');
} else if (translatePkg && typeof translatePkg.translate === 'function') {
  console.log('translatePkg.translate IS a function');
} else {
  console.log('Value of translatePkg:', translatePkg);
}
