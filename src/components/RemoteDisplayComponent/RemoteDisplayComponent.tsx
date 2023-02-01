import { createRef, useEffect } from 'react';
import { isContext } from 'vm';
import { ImageBound, calculateBounds } from '../../utils/geometry';

import styles from './RemoteDisplayComponent.module.css';

interface RemoteDisplayComponentProps {}

const RemoteDisplayComponent = () => {
  // const imgURI: string = 'https://www.dndbeyond.com/attachments/5/762/map-gnomegarde-pc.jpg';
  const imgURI: string = 'map-gnomegarde-pc.jpg';
  const fowRef = createRef<HTMLCanvasElement>();
  const mapRef = createRef<HTMLDivElement>();
  let image: HTMLImageElement | null = null;
  let down: boolean = false;
  let mouseStartX: number = 0;
  let mouseStartY: number = 0;
  let mouseEndX: number = 0;
  let mouseEndY: number = 0;
  let baseData: ImageData | null;

  const mouseDown = (event: MouseEvent) => {
    console.log(`Mouse down (${event.x}, ${event.y})`);
    mouseStartX = event.x;
    mouseStartY = event.y;
    down = true;
  }

  const mouseUp = (event: MouseEvent) => {
    down = false;
    mouseEndX = event.x;
    mouseEndY = event.y;
  }
  
  const mouseMove = (event: MouseEvent) => {
    if (!down) return;
    if (event.x == mouseEndX && event.y == mouseEndY) return;
    mouseEndX = event.x;
    mouseEndY = event.y;
    const canvas = fowRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    if (!baseData) return;
    ctx.putImageData(baseData, 0, 0);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(mouseStartX,mouseStartY,mouseEndX-mouseStartX,mouseEndY-mouseStartY);
  }

  const imgLoaded = () => {
    if (!image) {
      // TODO SIGNAL ERROR
      console.error(`Image is invalid`);
      return;
    }

    const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

    console.log(`Image  is ${image.width} x ${image.height}`);
    console.log(`Window is ${width} x ${height}`);

    const canvas = fowRef.current;
    if (!canvas) {
      // TODO SIGNAL ERROR
      console.error('Unable to get Canvas element');
      return;
    }
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (!ctx) {
      // TODO SIGNAL ERROR
      console.error(`Unable to get canvas context`);
      return;
    }

    let bounds = calculateBounds(canvas.width, canvas.height, image.width, image.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    if (bounds.rotate) {
      ctx.rotate(90 * Math.PI/180);
    }
    ctx.drawImage(image, -bounds.width/2, -bounds.height/2, bounds.width, bounds.height);
    ctx.restore();

    baseData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.addEventListener('mousedown', mouseDown);
    canvas.addEventListener('mousemove', mouseMove);
    canvas.addEventListener('mouseup', mouseUp);

    ctx.save();
  }

  const imgFailed = () => {
    // TODO SIGNAL ERROR
    console.error(`Unable to load image`);
  }

  useEffect(() => {
    const img = new Image();
    img.id = 'mapImage'
    img.onload = function() {
      if (image) {
        console.log('Image already loaded');
        return;
      }
      image = this as HTMLImageElement;
      imgLoaded();
    }
    img.onerror = function() { imgFailed(); }
    img.src = imgURI;
  });

  return (
    <div className={styles.map} ref={mapRef} data-testid="RemoteDisplayComponent">
      <canvas id='fow' className={styles.fow} ref={fowRef}>Sorry, your browser does not support canvas.</canvas>
    </div>
  );
}

export default RemoteDisplayComponent;
