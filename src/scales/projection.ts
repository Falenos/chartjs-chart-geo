import { Scale, CoreScaleOptions } from 'chart.js';
import {
  geoPath,
  geoAzimuthalEqualArea,
  geoAzimuthalEquidistant,
  geoGnomonic,
  geoOrthographic,
  geoStereographic,
  geoEqualEarth,
  geoAlbers,
  geoAlbersUsa,
  geoConicConformal,
  geoConicEqualArea,
  geoConicEquidistant,
  geoEquirectangular,
  geoMercator,
  geoTransverseMercator,
  geoNaturalEarth1,
  GeoProjection,
  GeoPath,
  GeoPermissibleObjects,
  ExtendedFeatureCollection,
  ExtendedFeature,
  GeoGeometryObjects,
  ExtendedGeometryCollection,
} from 'd3-geo';

const lookup: { [key: string]: () => GeoProjection } = {
  geoAzimuthalEqualArea,
  geoAzimuthalEquidistant,
  geoGnomonic,
  geoOrthographic,
  geoStereographic,
  geoEqualEarth,
  geoAlbers,
  geoAlbersUsa,
  geoConicConformal,
  geoConicEqualArea,
  geoConicEquidistant,
  geoEquirectangular,
  geoMercator,
  geoTransverseMercator,
  geoNaturalEarth1,
};
Object.keys(lookup).forEach((key) => {
  lookup[`${key.charAt(3).toLowerCase()}${key.slice(4)}`] = lookup[key];
});

export interface IProjectionScaleOptions extends CoreScaleOptions {
  /**
   * projection method used
   * @default albersUsa
   */
  projection:
    | GeoProjection
    | 'azimuthalEqualArea'
    | 'azimuthalEquidistant'
    | 'gnomonic'
    | 'orthographic'
    | 'stereographic'
    | 'equalEarth'
    | 'albers'
    | 'albersUsa'
    | 'conicConformal'
    | 'conicEqualArea'
    | 'conicEquidistant'
    | 'equirectangular'
    | 'mercator'
    | 'transverseMercator'
    | 'naturalEarth1';
}

export class ProjectionScale extends Scale<IProjectionScaleOptions> {
  readonly geoPath: GeoPath<any, GeoPermissibleObjects>;
  projection!: GeoProjection;
  private outlineBounds: {
    refX: number;
    refY: number;
    refScale: number;
    width: number;
    height: number;
    aspectRatio: number;
  } | null = null;
  private oldChartBounds: { chartWidth: number; chartHeight: number } | null = null;

  constructor(cfg: any) {
    super(cfg);
    this.geoPath = geoPath();
  }

  init(options: IProjectionScaleOptions) {
    (options as any).position = 'chartArea';
    super.init(options);
    if (typeof options.projection === 'function') {
      this.projection = options.projection;
    } else {
      this.projection = (lookup[options.projection] || lookup['albersUsa']!)();
    }
    this.geoPath.projection(this.projection);
  }

  computeBounds(outline: ExtendedFeature): void;
  computeBounds(outline: ExtendedFeatureCollection): void;
  computeBounds(outline: GeoGeometryObjects): void;
  computeBounds(outline: ExtendedGeometryCollection): void;
  computeBounds(outline: any) {
    const bb = geoPath(this.projection.fitWidth(1000, outline)).bounds(outline);
    const bHeight = Math.ceil(bb[1][1] - bb[0][1]);
    const bWidth = Math.ceil(bb[1][0] - bb[0][0]);
    const t = this.projection.translate();

    this.outlineBounds = {
      width: bWidth,
      height: bHeight,
      aspectRatio: bWidth / bHeight,
      refScale: this.projection.scale(),
      refX: t[0],
      refY: t[1],
    };
  }

  updateBounds() {
    const area = this.chart.chartArea;
    const bb = this.outlineBounds!;

    const chartWidth = area.right - area.left;
    const chartHeight = area.bottom - area.top;

    const bak = this.oldChartBounds;
    this.oldChartBounds = {
      chartWidth,
      chartHeight,
    };

    const scale = Math.min(chartWidth / bb.width, chartHeight / bb.height);
    const viewWidth = bb.width * scale;
    const viewHeight = bb.height * scale;

    const x = (chartWidth - viewWidth) * 0.5;
    const y = (chartHeight - viewHeight) * 0.5;

    // this.mapScale = scale;
    // this.mapTranslate = {x, y};

    this.projection.scale(bb.refScale * scale).translate([scale * bb.refX + x, scale * bb.refY + y]);

    return (
      !bak || bak.chartWidth !== this.oldChartBounds.chartWidth || bak.chartHeight !== this.oldChartBounds.chartHeight
    );
  }

  static id = 'projection';
  static defaults: Partial<IProjectionScaleOptions> = {
    projection: 'albersUsa',
  };
}

declare module 'chart.js' {
  export enum ScaleTypeEnum {
    projection = 'projection',
  }

  export interface IScaleTypeRegistry {
    projection: {
      options: IProjectionScaleOptions;
    };
  }
}
