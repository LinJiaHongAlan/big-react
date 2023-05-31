import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';
// 生成package.json
import rollupPluginGeneratePackageJson from 'rollup-plugin-generate-package-json';
// 打包配置
import alias from '@rollup/plugin-alias';

// 拿到package中的name
const { name, module } = getPackageJSON('react-dom');
// react-dom包得到路径
const pkgPath = resolvePkgPath(name);
// react-dom产物路径
const pkgDistPath = resolvePkgPath(name, true);

export default [
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'index.js',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/client.js`,
				name: 'client.js',
				format: 'umd'
			}
		],
		plugins: [
			...getBaseRollupPlugins(),
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
