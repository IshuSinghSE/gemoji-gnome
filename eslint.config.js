import babelParser from '@babel/eslint-parser';

// ESLint config for GNOME Shell extensions (ESLint v9+)
export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                ecmaVersion: 2021,
                sourceType: 'module'
            }
        },
        rules: {
            indent: ['error', 4],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn'],
            'no-console': ['off'],
            'comma-dangle': ['error', 'never'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'space-before-function-paren': ['error', 'never'],
            'keyword-spacing': ['error', { before: true, after: true }],
            eqeqeq: ['error', 'always'],
            'no-var': ['error'],
            'prefer-const': ['error']
        }
    }
];
