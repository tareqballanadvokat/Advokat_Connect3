/* eslint-disable no-undef */

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const urlDev = "https://localhost:3000/";
const urlProd = "https://www.advokat.at/"; // CHANGE THIS TO YOUR PRODUCTION DEPLOYMENT LOCATION

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const config = {
    devtool: "source-map",
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      taskpane: ["./src/taskpane/taskpane.js", "./src/taskpane/taskpane.html"],
      commands: ["./src/commands/commands.js", "./src/commands/commands.html"],
      services: ["./src/services/service.js", "./src/services/service.html"],     
      emails: ["./src/email/email.js"],     
      index: ["./src/index.js","./src/index.html"],
    },
    output: {    
        filename: "[name].bundle.js",
        clean: true,
        publicPath: "/",
      
    },
    resolve: {
      extensions: [".html", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["polyfill", "taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "service.html",
        template: "./src/services/service.html",
        chunks: ["polyfill", "services"],
      }), 
      new HtmlWebpackPlugin({
        filename: "index.html",
        template: "./src/index.html",
        chunks: ["polyfill", "index"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "src/cases/case.html",
            to: "cases/case.html"
          }
        ]
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "./src/launchevent/launchevent.js",
            to: "launchevent.js",
          },
        ],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "manifest*.json",
            to: "[name]" + "[ext]",
            transform(content) {
              if (dev) {
                return content;
              } else {
                return content.toString().replace(new RegExp(urlDev, "g"), urlProd);
              }
            },
          },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["polyfill", "commands"],
      }),
    ],
    devServer: {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options: env.WEBPACK_BUILD || options.https !== undefined ? options.https : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
    },
  };

  return config;
}; 




//   const path = require("path");
// // const HtmlWebpackPlugin = require("html-webpack-plugin");

// module.exports = {
//   mode: "development",
//   entry: "./src/index.html",
//   output: {
//     path: path.resolve(__dirname, "dist"),
//     filename: "[name].[contenthash].js",
//     clean: true,
//   },
//   module: {
//     rules: [
//       {
//         test: /\.html$/,
//         use: "html-loader"
//       },
//       {
//         test: /\.js$/,
//         exclude: /node_modules/,
//         use: "babel-loader"
//       },
//       {
//         test: /\.css$/,
//         use: ["style-loader", "css-loader"]
//       },
//       {
//         test: /\.(png|jpg|jpeg|gif|svg)$/,
//         type: "asset/resource",
//         generator: {
//           filename: "assets/[name][ext]"
//         }
//       },
//       {
//         test: /\.(png|jpg|jpeg|gif|ico)$/,
//         type: "asset/resource",
//         generator: {
//           filename: "assets/[name][ext][query]",
//         }
//       }
//     ]
//   },
//   plugins: [
//     new HtmlWebpackPlugin({
//       template: "./src/index.html",
//       filename: "index.html"
//     })
//   ],
//   devServer: {
//     static: {
//       directory: path.join(__dirname, "dist")
//     },
//     port: 3000,
//     https: true,
//     open: true,
//     headers: {
//       "Access-Control-Allow-Origin": "*"
//     }
//   }
// };