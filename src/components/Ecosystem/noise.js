/**
 * ノイズ関数
 * https://www.michaelbromley.co.uk/blog/simple-1d-noise-in-javascript/
 */
export default class NoiseGenerator {
  /**
   * constructor
   * @param {Float} amplitude 振幅
   * @param {Float} scale 拡大率
   * @param {Float} seed random seed
   */
  constructor(amplitude = 1, scale = 1) {
    this.max_vertices = 256;
    this.max_vertices_mask = this.max_vertices - 1;
    this.amplitude = amplitude;
    this.scale = scale;

    this.r = [];
    for (let i = 0; i < this.max_vertices; i++) {
      this.r.push(Math.random());
    }
  }

  /**
   * 振幅の設定
   * @param {Float} amplitude 振幅
   */
  setAmplitude(amplitude) {
    this.aplitude = amplitude;
  }

  /**
   *
   * @param {float} scale scale値
   */
  setScale(scale) {
    this.scale = scale;
  }

  /**
   * generate noise random value
   * @param {Float} x x座標
   * @return {Float} random value
   */
  getValue(x) {
    const scaledX = x*this.scale;
    const xFloor = Math.floor(scaledX);
    const t = scaledX - xFloor;
    const tRemapSmoothStep = t * t * (3 - 2 * t);

    const xMin = xFloor & this.max_vertices_mask;
    const xMax = (xMin + 1) & this.max_vertices_mask;

    /**
     * Linear interpolation function.
     * @param {int} a The lower integer value
     * @param {int} b The upper integer value
     * @param {float} t The value between the two
     * @return {int}
     */
    function lerp(a, b, t) {
      return a * (1 - t) + b * t;
    }

    const y = lerp(this.r[xMin], this.r[xMax], tRemapSmoothStep);

    return y * this.amplitude;
  }
}
