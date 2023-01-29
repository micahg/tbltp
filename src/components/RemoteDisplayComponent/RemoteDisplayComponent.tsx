import { createRef, useEffect } from 'react';
import styles from './RemoteDisplayComponent.module.css';

interface RemoteDisplayComponentProps {}

const RemoteDisplayComponent = () => {
  const imgURI: string = 'https://www.dndbeyond.com/attachments/5/762/map-gnomegarde-pc.jpg';
  const fowRef = createRef<HTMLCanvasElement>();
  const mapRef = createRef<HTMLDivElement>();
  let image: HTMLOrSVGImageElement | null = null;

  const imgLoaded = () => {
    if (!image) {
      console.error(`Image is invalid`);
      return;
    }
    const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

    // const imageWide = img.width >= img.height;
    // const canvasWide = width >= height;

    // if (imageWide !== canvasWide) {
    //   img.style.height = `${width}px`;
    //   img.style.width = `${height}px`;
    //   img.style.transform = 'rotate(90deg)';
    //   img.style.zIndex = "-1";
    // }

    console.log(`Image  is ${image.width} x ${image.height}`);
    console.log(`Window is ${width} x ${height}`);

    const canvas = fowRef.current;
    if (!canvas) {
      // TODO SIGNAL ERROR
      console.error('Unable to get Canvas element');
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // TODO SIGNAL ERROR
      console.error(`Unable to get canvas context`);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 10, 10, 90, 90)
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(0,0,150,75);
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
      image = this as HTMLOrSVGImageElement;
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
