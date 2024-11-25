<script setup>
import { onMounted, ref } from "vue";
import jsonData from "./assets/yhlitemap_11.04.13.36.json";
import roadData from "./assets/road.json";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { wgs2utm, downFile } from "./utils/utils.js";
import { MeshLine, MeshLineMaterial } from "three.meshline";

let scene, camera, renderer, controls, raycaster;
const mouse = new THREE.Vector2();
let yhLines = new THREE.Group(),
  yhCircles = new THREE.Group(),
  yhStopLines = new THREE.Group(),
  yhRoad = new THREE.Group();
let origin_utm_x = 456788.630270388,
  origin_utm_y = 4426624.75945682,
  max_p = [0, 0],
  min_p = [0, 0],
  zPoint = 0.2,
  colors = {
    lanes: "red",
    marking_list: "blue",
    selectLine: "pink",
    selectCircle: "green",
    stoplines: "black",
  };
let selectData = ref({
    data: {}, // 选中线原始数据
    lineObj: null, // 选中的线元素
    info: {}, // 选中的线元素信息
    lanes: new Map(), // lanes转换过的数组
    marking_list: new Map(), // marking_list转换过的数组
    movePoints: [], // 用来存放当前选定线条的数据
  }),
  selectStop = ref({
    lineObj: null,
    data: {},
    movePoints: [],
    points: new Map(),
  }),
  selectCircle = ref({
    circleIndex: -1, // 选中的点元素下标
    circleObj: null, // 选中的点元素
  }),
  selectYHtype = ref(""),
  yhData = jsonData,
  isDragging = ref(false),
  dialogVisible = ref(false),
  fileName = ref("");

init();
animate();
onMounted(() => {});
function init() {
  ElMessage({
    message: "右键拖动 / 滚轮缩放 / 左键选择 / 双击放大到指定位置",
    type: "warning",
    duration: 0,
  });
  // 初始化场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeee);

  // 相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.01,
    100000
  );
  // 将摄像机位置设置到合适的地方
  camera.position.set(0, 0, 148);

  // 渲染器
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);

  controls.minDistance = 0.01; // 设置最小缩放距离
  // 禁止围绕 X 和 Y 轴旋转
  controls.enableRotate = true; // 启用旋转
  controls.maxPolarAngle = Math.PI / 2; // 最大俯视角度为 90 度
  controls.minPolarAngle = Math.PI / 2; // 最小俯视角度为 90 度
  // 禁用左键旋转
  controls.mouseButtons = {
    LEFT: null, // 禁用左键功能
    RIGHT: THREE.MOUSE.PAN, // 右键拖动画布
    MIDDLE: THREE.MOUSE.DOLLY, // 滚轮缩放
  };

  // 保留平移和缩放
  controls.enablePan = true; // 启用平移（右键拖动）
  controls.enableZoom = true; // 启用缩放
  controls.target.set(0, 0, 0);
  controls.update(); // 更新控制器

  // 光源
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 0, 100);
  scene.add(light);

  // 添加坐标轴
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
  // 绘制对比road
  handleRoad();
  // 绘制segments中lanes和marking_list
  handleDate(yhData.segments);
  handleStopLine(yhData.stoplines);
  // 设置视角
  setView();

  // 初始化 Raycaster
  raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  // raycaster.far = 1000; // 设置一个较大的检测距离
  raycaster.params.Line.threshold = 0.4; // 调整射线检测阈值

  // 事件监听
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("dblclick", onDblclick);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);
}
function onMouseDown(event) {
  event.preventDefault();
  if (event.button === 0) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.params.Points.threshold = 1.0; // 检测点的范围
    raycaster.setFromCamera(mouse, camera);
    // 检测交互
    const intersects = raycaster.intersectObjects([
      ...yhLines.children,
      ...yhCircles.children,
      ...yhStopLines.children,
    ]);
    if (intersects.length > 0) {
      let userData = intersects[0].object.userData;
      console.log("选中:", userData, selectData.value.info);
      let yhType = userData.yhType;

      if (userData.eleType === "line") {
        if (yhType == "marking_list" || yhType == "lanes") {
          let info = userData.yhInfo;
          if (
            yhType === selectYHtype.value &&
            info.segmentId === selectData.value.info.segmentId &&
            info.lineIndex === selectData.value.info.lineIndex
          )
            return;

          if (selectData.value.lineObj) {
            selectData.value.lineObj.material.color.setStyle(
              colors[selectYHtype.value]
            );
          }
          selectYHtype.value = yhType;
          selectData.value.lineObj = findLine(
            yhLines,
            `yh_${info.segIndex}_${yhType}_${info.lineIndex}`
          );
          selectData.value.info = info;
          selectData.value.data = findData(info);
          selectData.value.movePoints = selectData.value[yhType].get(
            info.segmentId
          )[info.lineIndex];

          handleCircles(selectData.value.data);
          selectData.value.lineObj.material.color.setStyle(colors.selectLine);
        }
        if (yhType == "stoplines") {
          selectYHtype.value = yhType;
          let objData = userData.objData;
          selectStop.value.data = yhData.stoplines.filter((item) => {
            return item.id === objData.id;
          })[0];
          selectStop.value.lineObj = findLine(
            yhStopLines,
            `yh_stoplines_${objData.id}`
          );
          selectStop.value.movePoints = selectStop.value.points.get(objData.id);
          handleCircles(selectStop.value.data);
          selectStop.value.lineObj.material.color.setStyle(colors.selectLine);
          console.log(selectStop.value, "selectStop.value");
        }
      } else if (userData.eleType === "circle") {
        let info = intersects[0].object.userData.yhInfo;
        if (selectCircle.value.circleObj) {
          selectCircle.value.circleObj.material.color.setStyle("red");
        }
        selectCircle.value.circleObj = findLine(
          yhCircles,
          `yh_circle_${info.pointIndex}`
        );
        isDragging.value = true;
        selectCircle.value.circleIndex = info.pointIndex;
        selectCircle.value.circleObj.material.color.setStyle(
          colors.selectCircle
        );
      }
    } else {
      if (selectData.value.lineObj) {
        selectData.value.lineObj.material.color.setStyle(colors[selectYHtype]);
        initSelect();
      }
      if (selectStop.value.lineObj) {
        selectStop.value.lineObj.material.color.setStyle(colors[selectYHtype]);
        initSelect();
      }
    }
  }
}
// 初始化选择数组
function initSelect() {
  clear(yhCircles);
  selectData.value.data = {};
  selectData.value.lineObj = null;
  selectData.value.info = {};
  selectData.value.movePoints = [];
  selectCircle.value.circleIndex = -1;
  selectCircle.value.circleObj = null;
  selectYHtype.value = "";
  selectStop.value.lineObj = null;
  selectStop.value.data = {};
  selectStop.value.movePoints = [];
}
function findLine(group, name) {
  return group.children.filter((ele) => {
    return ele.name === name;
  })[0];
}
function onMouseMove(event) {
  event.preventDefault();
  if (isDragging.value) {
    const intersection = getWordPoint(event.clientX, event.clientY);
    const selectedCircle = yhCircles.children[selectCircle.value.circleIndex];
    if (selectedCircle) {
      const attribute = selectedCircle.geometry.attributes.position;

      // 更新点的坐标（假设点的索引为 0）
      attribute.setXYZ(0, intersection.x, intersection.y, zPoint);
      attribute.needsUpdate = true;
      // 更新几何体的包围盒（确保射线检测正确）
      selectedCircle.geometry.computeBoundingBox();
      selectedCircle.geometry.computeBoundingSphere();
      let points = [],
        lineObj = null;

      if (
        selectYHtype.value === "marking_list" ||
        selectYHtype.value == "lanes"
      ) {
        points = selectData.value.movePoints;
        lineObj = selectData.value.lineObj;
      } else if (selectYHtype.value == "stoplines") {
        points = selectStop.value.movePoints;
        lineObj = selectStop.value.lineObj;
      }
      points[selectCircle.value.circleIndex] = new THREE.Vector3(
        intersection.x,
        intersection.y,
        0.1
      );
      lineObj.geometry.setFromPoints(points);
      lineObj.geometry.attributes.position.needsUpdate = true; // 通知更新
      if (
        selectYHtype.value === "marking_list" ||
        selectYHtype.value == "lanes"
      ) {
        selectData.value.movePoints = points;
      } else {
        selectStop.value.movePoints = points;
      }
    } else {
      console.log(console.warn("未找到有效的圆对象"));
    }
    // 手动更新渲染
    renderer.render(scene, camera);
  }
}
function onMouseUp(event) {
  if (isDragging.value) {
    isDragging.value = false;
    let points = [];
    if (selectYHtype.value == "marking_list" || selectYHtype.value == "lanes") {
      points = selectData.value[selectYHtype.value].get(
        selectData.value.info.segmentId
      );
      points[selectData.value.info.lineIndex] = selectData.value.movePoints;
      selectData.value[selectYHtype.value].set(
        selectData.value.info.segmentId,
        points
      );
      let point =
        points[selectData.value.info.lineIndex][selectCircle.value.circleIndex];
      selectData.value.data.points[
        selectCircle.value.circleIndex
      ] = `${point.x},${point.y}`;

      yhData.segments[selectData.value.info.segIndex][selectYHtype.value][
        selectData.value.info.lineIndex
      ] = selectData.value.data;
    }
    if (selectYHtype.value == "stoplines") {
      points = selectStop.value.points.get(selectStop.value.data.id);
      points[selectData.value.info.lineIndex] = selectStop.value.movePoints;
      selectStop.value.points.set(selectStop.value.data.id, points);
      let point = selectStop.value.movePoints[selectCircle.value.circleIndex];
      selectStop.value.data.geometry[
        selectCircle.value.circleIndex
      ] = `${point.x},${point.y}`;
    }

    // handleDate(yhData.segments);
    // handleStopLine(yhData.stoplines);
  }
}
// 双击事件
function onDblclick(event) {
  const point = getWordPoint(event.clientX, event.clientY);
  camera.position.set(point.x, point.y, 60);
  controls.target.set(point.x, point.y, 0.3);
  camera.updateProjectionMatrix();
  controls.update();
}
function getWordPoint(clientX, clientY) {
  // 将鼠标坐标转换为世界坐标
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -zPoint); // z = 0 的平面
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersection);
  return intersection;
}
function onKeyDown(event) {
  if (event.key === "Backspace" || event.key === "Delete") {
    if (
      (!selectData.value.lineObj && selectYHtype.value === "lanes") ||
      (!selectStop.value.lineObj && selectYHtype.value === "stoplines")
    )
      return;
    dialogVisible.value = true;
  } else if (dialogVisible.value && (event.key === "p" || event.key === "P")) {
    delPoint();
  } else if (dialogVisible.value && (event.key === "l" || event.key === "L")) {
    delLine();
  }
}
function delPoint() {
  if (selectCircle.value.circleIndex === -1) return;
  let { info, data, lineObj, movePoints } = selectData.value;
  let { circleIndex, circleObj } = selectCircle.value;

  movePoints.splice(circleIndex, 1);
  let points = selectData.value[selectYHtype.value].get(
    selectData.value.info.segmentId
  );
  points[info.lineIndex] = movePoints;
  selectData.value[selectYHtype.value].set(
    selectData.value.info.segmentId,
    points
  );
  data.points.splice(circleIndex, 1);
  lineObj = findLine(
    yhLines,
    `yh_${info.segIndex}_${selectYHtype.value}_${info.lineIndex}`
  );
  lineObj.geometry.dispose();
  lineObj.material.dispose();
  yhLines.remove(lineObj);
  scene.remove(lineObj);
  clear(yhCircles);
  circleObj = null;
  circleIndex = -1;

  if (data.points.length) {
    drawLine(
      handleLineData(data.points),
      colors[selectYHtype.value],
      info.segIndex,
      info.lineIndex,
      selectYHtype.value,
      info.segmentId,
      yhLines
    );
    lineObj = findLine(
      yhLines,
      `yh_${info.segIndex}_${selectYHtype.value}_${info.lineIndex}`
    );
    lineObj.material.color.setStyle(colors.selectLine);
    selectData.value.lineObj = lineObj;
    handleCircles(data);
  }

  dialogVisible.value = false;
}
function delLine() {
  if (selectYHtype.value == "lanes" || selectYHtype.value == "marking_list") {
    if (!selectData.value.lineObj) return;
    yhData.segments[selectData.value.info.segIndex][selectYHtype.value].splice(
      selectData.value.info.lineIndex,
      1
    );
    let points = selectData.value[selectYHtype.value].get(
      selectData.value.info.segmentId
    );
    let info = selectData.value.info;
    let lines = [];
    points.forEach((item, index) => {
      lines.push(
        findLine(yhLines, `yh_${info.segIndex}_${selectYHtype.value}_${index}`)
      );
    });
    lines.forEach((item) => {
      item.geometry.dispose();
      item.material.dispose();
      yhLines.remove(item);
      scene.remove(item);
    });

    points.splice(selectData.value.info.lineIndex, 1);
    points.forEach((item, index) => {
      drawLine(
        item,
        colors[selectYHtype.value],
        info.segIndex,
        index,
        selectYHtype.value,
        info.segmentId,
        yhLines
      );
    });
    selectData.value[selectYHtype.value].set(
      selectData.value.info.segmentId,
      points
    );
  }
  if (selectYHtype.value == "stoplines") {
    if (!selectStop.value.lineObj) return;
    let index = -1;
    yhData.stoplines.map((ele, i) => {
      if (ele.id === selectStop.value.data.id) {
        index = i;
      }
    });
    console.log(index, "index======", selectStop.value, yhData.stoplines);

    yhData.stoplines.splice(index, 1);
    let lineObj = findLine(
      yhStopLines,
      `yh_${selectYHtype.value}_${selectStop.value.data.id}`
    );
    lineObj.geometry.dispose();
    lineObj.material.dispose();
    yhStopLines.remove(lineObj);
    scene.remove(lineObj);
    selectStop.value.points.delete(selectStop.value.data.id);
  }
  initSelect();
  dialogVisible.value = false;
}
function delRoad() {}
function handleRoad() {
  roadData.features.forEach((item, index) => {
    let arr = [],
      arr_1 = [];
    item.geometry.coordinates.forEach((ele) => {
      let point = wgs2utm(ele[0], ele[1]);
      arr.push([point[0] - origin_utm_x, point[1] - origin_utm_y, 0.1]);
      arr_1.push([point[0] - origin_utm_x, point[1] - origin_utm_y, 0.3]);
    });
    // 创建 LineGeometry 和 LineMaterial
    const geometry = new LineGeometry();
    geometry.setPositions(arr.flat()); // 设置顶点数据
    const material = new LineMaterial({
      color: 0x23bac5, // 线条颜色
      linewidth: 3.4, // 设置线宽，单位是像素
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight), // 用于调整线宽的渲染分辨率
    });
    geometry.setPositions(arr_1.flat()); // 设置顶点数据
    const material_1 = new LineMaterial({
      color: 0xffffff, // 线条颜色
      linewidth: 1, // 设置线宽，单位是像素
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight), // 用于调整线宽的渲染分辨率
    });

    // 创建线条对象
    const line = new Line2(geometry, material);
    const line_1 = new Line2(geometry, material_1);
    yhRoad.add(line);
    yhRoad.add(line_1);
    scene.add(yhRoad);
  });
}
function handleDate(segments) {
  segments.forEach((item, index) => {
    if (item.lanes.length) {
      item.lanes.forEach((e, i) => {
        if (e.points.length) {
          const arr = handleLineData(e.points);
          if (selectData.value.lanes.has(item.segmentId)) {
            const points = selectData.value.lanes.get(item.segmentId);
            points.push(arr);
            selectData.value.lanes.set(item.segmentId, points);
          } else {
            selectData.value.lanes.set(item.segmentId, [arr]);
          }
          drawLine(
            arr,
            colors["lanes"],
            index,
            i,
            "lanes",
            item.segmentId,
            yhLines
          );
        }
      });
    }
    if (item.marking_list.length) {
      item.marking_list.forEach((e, i) => {
        if (e.points.length) {
          const arr = handleLineData(e.points, true, i);
          if (selectData.value.marking_list.has(item.segmentId)) {
            const points = selectData.value.marking_list.get(item.segmentId);
            points.push(arr);
            selectData.value.marking_list.set(item.segmentId, points);
          } else {
            selectData.value.marking_list.set(item.segmentId, [arr]);
          }
          drawLine(
            arr,
            colors["marking_list"],
            index,
            i,
            "marking_list",
            item.segmentId,
            yhLines
          );
        }
      });
    }
  });
}
function handleStopLine(stoplines) {
  stoplines.forEach((item, index) => {
    const arr = handleLineData(item.geometry);
    if (selectStop.value.points.has(item.id)) {
      const points = selectStop.value.points.get(item.id);
      points.push(arr);
      selectStop.value.points.set(item.id, points);
    } else {
      selectStop.value.points.set(item.id, arr);
    }
    drawLine(arr, colors.stoplines, -1, -1, "stoplines", -1, yhStopLines, item);
  });
}
function handleLineData(points, sign = false, index) {
  let arr = points.map((ele, i) => {
    let p = ele.split(",");
    if (sign) {
      if (index === 0 && i === 0) {
        max_p = [Number(p[0]), Number(p[1])];
        min_p = [Number(p[0]), Number(p[1])];
      } else {
        max_p[0] = Math.max(max_p[0], Number(p[0]));
        max_p[1] = Math.max(max_p[1], Number(p[1]));
        min_p[0] = Math.min(min_p[0], Number(p[0]));
        min_p[1] = Math.min(min_p[1], Number(p[1]));
      }
    }
    return new THREE.Vector3(Number(p[0]), Number(p[1]), 0);
  });

  return arr;
}
// 绘制线条
function drawLine(
  points,
  color,
  segIndex,
  lineIndex,
  type,
  segmentId,
  group,
  objData = null
) {
  const material_main = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
  });
  const geometry_main = new THREE.BufferGeometry().setFromPoints(points);
  const line_main = new THREE.Line(geometry_main, material_main);
  line_main.userData.yhType = type;
  line_main.userData.eleType = "line";

  if (objData) {
    line_main.userData.objData = objData;
    line_main.name = `yh_stoplines_${objData.id}`;
  } else {
    line_main.name = `yh_${segIndex}_${type}_${lineIndex}`;
    line_main.userData.yhInfo = {
      segIndex: segIndex,
      lineIndex: lineIndex,
      lineType: type,
      segmentId: segmentId,
      type: "line",
    };
  }
  group.add(line_main);
  scene.add(group);
}
function findData(info) {
  let data = yhData.segments[info.segIndex][selectYHtype.value][info.lineIndex];
  if (yhData.segments[info.segIndex].segmentId == info.segmentId) {
    return data;
  } else {
    return null;
  }
}
function handleCircles(data, group = yhCircles) {
  if (group.children.length) {
    clear(group);
  }
  let points = [];
  if (data.points) {
    points = data.points;
  } else {
    points = data.geometry;
  }
  points.map((ele, index) => {
    let p = ele.split(",");
    drawCircle(
      new THREE.Vector3(Number(p[0]), Number(p[1]), zPoint),
      index,
      group
    );
  });
}
function clear(group) {
  group.children.forEach((child) => {
    child.geometry.dispose();
    child.material.dispose();
    group.remove(child);
    child = null;
  });
  group.clear();
}
function drawCircle(positions, index, group) {
  let geometry = new THREE.BufferGeometry().setFromPoints([positions]);
  // 创建点的材质
  const material = new THREE.PointsMaterial({
    color: 0xff0000, // 点的颜色
    size: 0.5, // 点的大小
    sizeAttenuation: true, // 根据距离缩放点大小
  });
  // 创建点
  const points = new THREE.Points(geometry, material);
  points.userData.eleType = "circle";
  points.userData.yhInfo = {
    pointIndex: index,
    type: "circle",
  };
  points.name = `yh_circle_${index}`;
  group.add(points);
  scene.add(group);
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
// 上传文件
function uploadFile(event) {
  let file = event.target.files[0];
  console.log(file, "oooooooo");
  fileName.value = file.name;
  if (!file.name.includes("yh")) {
    ElMessage({
      message: "文件名中必须包含yh字样",
      type: "warning",
    });
  }
  if (file.type != "application/json" || !fileName.value.includes(".json")) {
    ElMessage({
      message: "只允许上传json文件",
      type: "warning",
    });
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    yhData = JSON.parse(reader.result);
    clearAll();
    origin_utm_x = yhData.origin_utm_x;
    origin_utm_y = yhData.origin_utm_y;
    handleDate(yhData.segments);
    handleRoad();
    console.log(yhData, "yhData");
  };
  reader.readAsText(file);
}
// 保存文件
function save() {
  downFile(yhData, "yh_test.json");
}
// 清除所有文件绘制的线条
function clearAll() {
  initSelect();
  clear(yhLines);
  clear(yhStopLines);
  clear(yhRoad);
  selectData.value.lanes.clear();
  selectData.value.marking_list.clear();
  selectStop.value.points.clear();
}
// 设置视角
function setView() {
  const centerX = (min_p[0] + max_p[0]) / 2;
  const centerY = (min_p[1] + max_p[1]) / 2;
  const width = max_p[0] - min_p[0];
  const height = max_p[1] - min_p[1];
  const distance = Math.max(width, height) * 4.5; // 假设是正交投影

  camera.position.set(centerX, centerY, distance);
  controls.target.set(centerX, centerY, 0.3);
  camera.updateProjectionMatrix();
  controls.update();
}
</script>

<template>
  <!-- <div ref="canvasContainer" class="main_box"></div> -->
  <div>
    <el-dialog v-model="dialogVisible" title="请选择你要删除的类型" width="500">
      <div
        class="dialog_text"
        v-show="selectYHtype == 'lanes' || selectYHtype == 'marking_list'"
      >
        <div class="text_point">删除点：</div>
        删除掉选定的那个点
        <el-button type="warning" @click="delPoint">删除点( P )</el-button>
      </div>
      <div class="dialog_text">
        <div class="text_line">删除线：</div>
        删除掉选定的那条线
        <el-button type="primary" @click="delLine"> 删除线 ( L ) </el-button>
      </div>
      <!-- <div class="dialog_text">
        <div class="text_road">删除整条道路：</div>
        删除掉选定线所在的道路<el-button type="danger" @click="delRoad">
          删除整条道路 ( R )
        </el-button>
      </div> -->
    </el-dialog>
    <div class="tools_box">
      <el-button type="primary" class="upload_btn"
        >选择 YH 文件
        <input
          ref="file"
          class="input_file"
          type="file"
          accept="application/json"
          title=""
          @change="uploadFile"
        />
      </el-button>
      <el-button type="success" class="save_btn" @click="save"
        >保存文件</el-button
      >
    </div>
    <el-button type="primary" class="init_btn" @click="setView"
      >一键复位</el-button
    >
  </div>
</template>

<style scoped>
.main_box {
  width: 100vw;
  height: 100vh;
}
.line_css {
  cursor: pointer;
}
.yh_dialog_footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text_line {
  color: #409eff;
}
.text_point {
  color: #e6a23c;
}
.text_road {
  color: #f56c6c;
}
.dialog_text {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}
.dialog_text:last-child {
  border-bottom: 0;
}
.tools_box {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.upload_btn {
  position: relative;
  margin-bottom: 6px;
}
.input_file {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #409eff;
  opacity: 0;
}
.init_btn {
  position: absolute;
  bottom: 10px;
  left: 10px;
}
.save_btn {
  margin-left: 0 !important;
}
</style>
