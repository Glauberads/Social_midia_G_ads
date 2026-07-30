module.exports = {
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/modules/**/domain/**/*' },
      { type: 'nestjs', pattern: '@nestjs/*' }
    ]
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'boundaries/element-types': [
      2,
      {
        default: 'allow',
        rules: [
          {
            from: 'domain',
            disallow: ['nestjs'],
            message: 'O domÃ­nio nÃ£o pode importar NestJS (Clean Architecture).'
          }
        ]
      }
    ]
  }
};
