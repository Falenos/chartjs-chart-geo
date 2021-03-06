import {
  BubbleController,
  Chart,
  ChartItem,
  ChartConfiguration,
  CommonHoverOptions,
  ControllerDatasetOptions,
  PointOptions,
  PointProps,
  ScriptableContext,
  TooltipItem,
  PointElement,
  Scale,
  ScriptableAndArrayOptions,
  UpdateMode,
} from 'chart.js';
import { merge } from 'chart.js/helpers';
import { GeoFeature, IGeoFeatureOptions } from '../elements';
import { ProjectionScale, SizeScale } from '../scales';
import { GeoController, geoDefaults, IGeoChartOptions } from './geo';
import patchController from './patchController';

export class BubbleMapController extends GeoController<PointElement> {
  initialize() {
    super.initialize();
    this.enableOptionSharing = true;
  }
  linkScales() {
    super.linkScales();
    const dataset = this.getGeoDataset();
    const meta = this.getMeta();
    meta.vAxisID = meta.rAxisID = 'r';
    dataset.vAxisID = dataset.rAxisID = 'r';
    meta.rScale = this.getScaleForId('r');
    meta.vScale = meta.rScale;
    meta.iScale = meta.xScale;
    meta.iAxisID = dataset.iAxisID = meta.xAxisID!;
  }

  _getOtherScale(scale: Scale) {
    // for strange get min max with other scale
    return scale;
  }

  parse(start: number, count: number) {
    const rScale = this.getMeta().rScale!;
    const data = (this.getDataset().data as unknown) as IBubbleMapDataPoint[];
    const meta = this._cachedMeta;
    for (let i = start; i < start + count; ++i) {
      const d = data[i];
      meta._parsed[i] = {
        x: d.longitude == null ? d.x : d.longitude,
        y: d.latitude == null ? d.y : d.latitude,
        [rScale.axis]: rScale.parse(d, i),
      };
    }
  }

  updateElements(elems: PointElement[], start: number, count: number, mode: UpdateMode) {
    const reset = mode === 'reset';
    const firstOpts = this.resolveDataElementOptions(start, mode);
    const sharedOptions = this.getSharedOptions(firstOpts);
    const includeOptions = this.includeOptions(mode, sharedOptions);
    const scale = this.getProjectionScale();

    (this.getMeta().rScale! as SizeScale)._model = firstOpts; // for legend rendering styling

    this.updateSharedOptions(sharedOptions, mode, firstOpts);

    for (let i = start; i < start + count; i++) {
      const elem = elems[i];
      const parsed = this.getParsed(i);
      const xy = scale.projection!([parsed.x, parsed.y]);
      const properties: PointProps & { options?: PointOptions; skip: boolean } = {
        x: xy ? xy[0] : 0,
        y: xy ? xy[1] : 0,
        skip: Number.isNaN(parsed.x) || Number.isNaN(parsed.y),
      };
      if (includeOptions) {
        properties.options = sharedOptions || this.resolveDataElementOptions(i, mode);
        if (reset) {
          properties.options!.radius = 0;
        }
      }
      this.updateElement(elem, i, properties, mode);
    }
  }

  indexToRadius(index: number) {
    const rScale = this.getMeta().rScale as SizeScale;
    return rScale.getSizeForValue(this.getParsed(index)[rScale.axis]);
  }

  static readonly id = 'bubbleMap';

  static readonly defaults: any = merge({}, [
    geoDefaults,
    {
      dataElementType: PointElement.id,
      dataElementOptions: BubbleController.defaults.dataElementOptions,
      datasetElementType: GeoFeature.id,
      showOutline: true,
      clipMap: 'outline+graticule',
      plugins: {
        tooltip: {
          callbacks: {
            title() {
              // Title doesn't make sense for scatter since we format the data as a point
              return '';
            },
            label(item: TooltipItem) {
              if (item.formattedValue == null) {
                return item.chart.data.labels[item.dataIndex];
              }
              return `${item.chart.data.labels[item.dataIndex]}: ${item.formattedValue}`;
            },
          },
        },
      },
      scales: {
        r: {
          type: SizeScale.id,
        },
      },
      elements: {
        point: {
          radius(context: ScriptableContext) {
            if (context.dataIndex == null) {
              return null;
            }
            const controller = context.chart.getDatasetMeta(context.datasetIndex).controller as BubbleMapController;
            return controller.indexToRadius(context.dataIndex);
          },
          hoverRadius: undefined,
        },
      },
    },
  ]);
}

export interface IBubbleMapDataPoint {
  longitude: number;
  latitude: number;
  x?: number;
  y?: number;
  value: number;
}

export interface IBubbleMapControllerDatasetOptions
  extends ControllerDatasetOptions,
    IGeoChartOptions,
    ScriptableAndArrayOptions<IGeoFeatureOptions>,
    ScriptableAndArrayOptions<CommonHoverOptions> {}

declare module 'chart.js' {
  export interface ChartTypeRegistry {
    bubbleMap: {
      chartOptions: IGeoChartOptions;
      datasetOptions: IBubbleMapControllerDatasetOptions;
      defaultDataPoint: IBubbleMapDataPoint[];
      scales: keyof IScaleTypeRegistry;
    };
  }
}

export class BubbleMapChart<DATA extends unknown[] = IBubbleMapDataPoint[], LABEL = string> extends Chart<
  'bubbleMap',
  DATA,
  LABEL
> {
  static id = BubbleMapController.id;

  constructor(item: ChartItem, config: Omit<ChartConfiguration<'bubbleMap', DATA, LABEL>, 'type'>) {
    super(item, patchController('bubbleMap', config, BubbleMapController, GeoFeature, [SizeScale, ProjectionScale]));
  }
}
