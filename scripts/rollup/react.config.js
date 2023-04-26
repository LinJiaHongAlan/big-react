import { getPackageJSON, resolvePkgPath } from './utils';
// 打包配置

// 拿到package中的name
const { name, module } = getPackageJSON('react');
// react包得到路径
const pkgPath = resolvePkgPath(name);
// react产物路径
const pkgDistPath = resolvePkgPath(name, true);

export default [
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pkgDistPath}/index.js`,
			name: 'index.js',
			format: 'umd'
		}
	}
];
