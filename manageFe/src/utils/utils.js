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
