import {useEffect, useRef} from 'react';

/**
 *
 * @param {function} callback delay経過後に実行されるコールバック関数
 * @param {int} delay ミリ秒
 */
export default function useInterval(callback, delay) {
  const savedCallback = useRef(() => {});

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const intervId = setInterval(() => savedCallback.current(), delay || 0);
      return () => clearInterval(intervId);
    }
    return undefined;
  }, [delay]);
}
