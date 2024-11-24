import proj4 from "proj4";
export function wgs2utm(lon, lat) {
  // 定义 WGS84 坐标系（经纬度）
  const wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

  // 定义 UTM 坐标系（Zone 50N）
  const utmZone50N = `+proj=utm +zone=${getUTMZone(
    lon
  )} +datum=WGS84 +units=m +no_defs`;
  // 转换 WGS84 坐标到 UTM
  const utmCoords = proj4(wgs84, utmZone50N, [lon, lat]);
  return utmCoords;
}
// 计算 UTM 区域
export function getUTMZone(lon) {
  return Math.floor((lon + 180) / 6) + 1;
}
export function downFile(jsonData, name) {
  // 将 JSON 数据转换为字符串
  const jsonString = JSON.stringify(jsonData, null, 2);  // 格式化为美观的 JSON 字符串

  // 创建一个 Blob 对象，其中 'application/json' 指定了文件类型
  const blob = new Blob([jsonString], { type: "application/json" });

  // 创建一个临时的链接元素
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);  // 使用 URL.createObjectURL 创建文件的下载链接
  link.download = name;  // 指定下载的文件名
  // 模拟点击下载链接
  link.click();
}
