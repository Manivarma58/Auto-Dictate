import translatePkg from 'google-translate-api-next';
const { translate } = translatePkg;

async function test() {
  try {
    const res = await translate('नमस्ते', { from: 'hi', to: 'te' });
    console.log('Result:', res.text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
