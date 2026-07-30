module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['boundaries', '@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'apps/api/src/modules/**/domain/**/*' },
      { type: 'application', pattern: 'apps/api/src/modules/**/application/**/*' },
      { type: 'infrastructure', pattern: 'apps/api/src/modules/**/infrastructure/**/*' },
      { type: 'presentation', pattern: 'apps/api/src/modules/**/presentation/**/*' },
      { type: 'nestjs', pattern: '@nestjs/*' },
      { type: 'prisma', pattern: '@prisma/*' },
      { type: 'web', pattern: 'apps/web/**/*' },
      { type: 'database', pattern: '@projeto/database' },
      { type: 'packages', pattern: 'packages/**/*' }
    ]
  },
  rules: {
    'boundaries/element-types': [
      2,
      {
        default: 'allow',
        rules: [
          { from: 'domain', disallow: ['nestjs', 'prisma', 'infrastructure'], message: 'Domain imports restricted.' },
          { from: 'application', disallow: ['presentation'], message: 'Application cannot import presentation.' },
          { from: 'web', disallow: ['database'], message: 'Web cannot import database.' },
          { from: 'packages', disallow: ['web', 'api'], message: 'Packages cannot import apps.' }
        ]
      }
    ]
  },
  env: {
    node: true,
    jest: true
  }
};
