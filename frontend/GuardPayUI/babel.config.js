module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json', '.node'],
        alias: {
          '@screens': './src/screens',
          '@components': './src/components',
          '@services': './src/services',
          '@theme': './src/theme',
          '@mock': './src/mock',
          '@types': './src/types',
          '@i18n': './src/i18n',
          '@navigation': './src/navigation',
        },
      },
    ],
  ],
};
