let canvas, ctx, container;
let scale = 1; // 初始缩放比例
let translateX = 0,
  translateY = 0; // 初始平移偏移量
let isDragging = false; // 是否正在拖动
let startX, startY; // 鼠标起始位置
let scaleNum = 1;

function getData() {
  fetch("/yhlitemap_1017.json")
    .then((res) => {
      return res.json();
    })
    .then((data) => {
      initCanvas(data.segments);
    });
}
function initCanvas(data) {
  container = document.getElementById("container");
  canvas = document.getElementById("myCanvas");
  ctx = canvas.getContext("2d");
  // 设置画布的逻辑大小
  const logicalWidth = 5000;
  const logicalHeight = 5000;
  canvas.width = logicalWidth;
  canvas.height = logicalHeight;
  // 设置缩放比例，确保画布填满容器
  const scale = Math.min(
    container.clientWidth / logicalWidth,
    container.clientHeight / logicalHeight
  );
  // 物理像素大小适配
  // canvas.style.width = logicalWidth * scale + "px";
  // canvas.style.height = logicalHeight * scale + "px";
  console.log(scale, "scale");

  // 绘制内容
  ctx.scale(0.1, 0.1); // 缩放逻辑坐标系
  ctx.fillStyle = "lightblue";
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  ctx.translate(canvas.width / 2, canvas.height / 2);

  // // 绘制坐标轴
  ctx.strokeStyle = "pink";
  ctx.beginPath();
  ctx.moveTo(-canvas.width / 2, 0); // X轴
  ctx.lineTo(canvas.width / 2, 0);
  ctx.moveTo(0, -canvas.height / 2); // Y轴
  ctx.lineTo(0, canvas.height / 2);
  ctx.stroke();
  // 缩放事件监听
  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    console.log(e.wheelDelta, "e", e.detail);
    let down = e.wheelDelta ? e.wheelDelta < 0 : e.detail > 0;
    if (!down) {
      scaleNum = (Number(scaleNum) + 0.005).toFixed(3);
      console.log("鼠标滚轮向下放大---------", scaleNum);
    } else {
      if (scaleNum == 0.001) {
        scaleNum = 0.001;
        return;
      } else {
        scaleNum = (Number(scaleNum) - 0.005).toFixed(3);
      }
      console.log("鼠标滚轮向上缩小++++++++++", scaleNum);
    }
    updateTransform();
  });
  // 开始拖动画布
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX - translateX; // 记录鼠标相对画布的偏移
    startY = e.clientY - translateY;
  });
  // 停止拖动画布
  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    container.style.cursor = "grab";
  });

  // 拖动画布
  canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    }
  });
  // 禁止右键菜单
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  console.log(data, "data");
  data?.forEach((item, index) => {
    // console.log(item, "item");

    item.marking_list?.forEach((ele, i) => {
      drawLine(ele, "red");
    });
    item.lanes?.forEach((ele, i) => {
      drawLine(ele, "blue");
    });
  });
}
// 设置画布的平移和缩放
function updateTransform() {
  canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleNum})`;
}

function drawLine(lines, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  // console.log(lines, "lines");

  lines.points?.forEach((item, index) => {
    let arr = item.split(",");
    if (index === 0) {
      ctx.moveTo(Number(arr[0]), Number(arr[1]));
    } else {
      ctx.lineTo(Number(arr[0]), Number(arr[1]));
    }
  });
  ctx.stroke();
}
initCanvas();
getData();
