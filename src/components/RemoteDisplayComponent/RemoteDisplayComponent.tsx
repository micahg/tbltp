import { createRef, useEffect } from 'react';
import { isContext } from 'vm';
import { ImageBound, calculateBounds } from '../../utils/geometry';

import styles from './RemoteDisplayComponent.module.css';

interface RemoteDisplayComponentProps {}

const RemoteDisplayComponent = () => {
  const imgURI: string = 'https://www.dndbeyond.com/attachments/5/762/map-gnomegarde-pc.jpg';
  const fowRef = createRef<HTMLCanvasElement>();
  const mapRef = createRef<HTMLDivElement>();
  let image: HTMLImageElement | null = null;

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
    ctx.fillStyle = "#FF0000";
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    if (bounds.rotate) {
      ctx.rotate(90 * Math.PI/180);
    }
    ctx.drawImage(image, -bounds.width/2, -bounds.height/2, bounds.width, bounds.height);
    ctx.restore();
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
