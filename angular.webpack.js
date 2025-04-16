//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

/**
 * Custom angular webpack configuration
 */
module.exports = (config, options) => {
    config.target = 'electron-renderer';

    if (options.fileReplacements) {
        for(let fileReplacement of options.fileReplacements) {
            if (fileReplacement.replace !== 'src/environments/environment.ts') {
                continue;
            }

            let fileReplacementParts = fileReplacement['with'].split('.');
            if (fileReplacementParts.length > 1 && ['web'].indexOf(fileReplacementParts[1]) >= 0) {
                config.target = 'web';
            }
            break;
        }
    }

    // Prevent the duplicate postcss-loader issue
    const rules = config.module.rules;
    const styleRules = rules.filter(rule => 
        rule.test && 
        (rule.test.toString().includes('.scss') || rule.test.toString().includes('.css'))
    );

    // Fix the processing pipeline for each style rule to avoid duplicate postCSS processing
    styleRules.forEach(rule => {
        // Handle different rule structures
        if (rule.oneOf) {
            rule.oneOf.forEach(oneOfRule => {
                if (oneOfRule.use) {
                    // Remove any existing postcss-loader to avoid duplicates
                    oneOfRule.use = oneOfRule.use.filter(loader => 
                        !(typeof loader === 'object' && loader.loader && loader.loader.includes('postcss-loader'))
                    );
                    
                    // Add our postcss-loader with tailwind configuration
                    oneOfRule.use.push({
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: [
                                    require('tailwindcss'),
                                    require('autoprefixer')
                                ]
                            }
                        }
                    });
                }
            });
        } else if (rule.use) {
            // Remove any existing postcss-loader to avoid duplicates
            rule.use = rule.use.filter(loader => 
                !(typeof loader === 'object' && loader.loader && loader.loader.includes('postcss-loader'))
            );
            
            // Add our postcss-loader with tailwind configuration
            rule.use.push({
                loader: 'postcss-loader',
                options: {
                    postcssOptions: {
                        plugins: [
                            require('tailwindcss'),
                            require('autoprefixer')
                        ]
                    }
                }
            });
        }
    });

    config.plugins = [
        ...config.plugins,
        new NodePolyfillPlugin({
            excludeAliases: ["console"]
        })
    ];

    return config;
}