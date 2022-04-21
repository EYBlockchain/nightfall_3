module.exports = api => {
  const isTest = api.cache(() => process.env.NODE_ENV === 'test');
  const presets = [];

  api.cache(true);

  if (isTest) {
    presets.push([
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ]);
  } else {
    presets.push([
      '@babel/preset-env',
      {
        targets: ['last 2 versions', 'maintained node versions'],
        useBuiltIns: 'usage',
        corejs: '3.8.1',
      },
    ]);
  }

  return {
    presets,
    ignore: [/\/core-js/],
  };
};
