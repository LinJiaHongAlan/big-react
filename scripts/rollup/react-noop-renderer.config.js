import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';
// 生成package.json
import rollupPluginGeneratePackageJson from 'rollup-plugin-generate-package-json';
// 打包配置
import alias from '@rollup/plugin-alias';

// 拿到package中的name
const { name, module, peerDependencies } = getPackageJSON('react-noop-renderer');
// react-noop-renderer包得到路径
const pkgPath = resolvePkgPath(name);
// react-noop-renderer产物路径
const pkgDistPath = resolvePkgPath(name, true);

export default [
	// react-noop-renderer
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'ReactNoopRenderer',
				format: 'umd'
			}
		],
		external: [...Object.keys(peerDependencies), 'scheduler'],
		plugins: [
			...getBaseRollupPlugins({
				typescript: {
					exclude: ['./packages/react-dom/**/*'],
					tsconfigOverride: {
						compilerOptions: {
							// baseUrl: path.resolve(pkgPath, '../'),
							paths: {
								hostConfig: [`./${name}/src/hostConfig.ts`]
							}
						}
					}
				}
			}),
			// 替换的包名
			alias({
				hostConfig: `${pkgPath}/src/hostConfig.ts`
			}),
			rollupPluginGeneratePackageJson({
				// 输入
				inputFolder: pkgPath,
				// 输出
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					peerDependencies: {
						react: version
					},
					main: 'index.js'
				})
			})
		]
	}
];
