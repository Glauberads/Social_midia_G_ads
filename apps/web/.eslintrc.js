module.exports = {
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'web', pattern: 'src/**/*' },
      { type: 'database', pattern: '@projeto/database' },
      { type: 'api', pattern: 'apps/api/**/*' }
    ]
  },
  rules: { '@typescript-eslint/no-explicit-any': 'off',
    'boundaries/element-types': [
      2,
      {
        default: 'allow',
        rules: [
          {
            from: 'web',
            disallow: ['database'],
            message: 'O frontend nÃ£o pode importar o banco de dados (@projeto/database).'
          },
          {
            from: 'web',
            disallow: ['api'],
            message: 'O frontend nÃ£o pode importar mÃ³dulos internos da API.'
          }
        ]
      }
    ]
  }
};
