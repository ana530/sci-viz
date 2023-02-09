export interface RestrictionStore {
    [key: string]: string[]
}

export interface SciVizSpec {
    SciViz: {
        pages: { [key: string]: SciVizPageType }
        auth: boolean
        website_title?: string
        favicon_name?: string
        header?: {
            image_route: string
            text: string
        }
        hostname?: string
        login?: {
            image_route: string
        }
    }
    version?: string
}

export interface SciVizPageType {
    route: string
    grids: { [key: string]: GridTypes }
    hidden?: boolean
}

export type GridTypes = SciVizFixedGrid | SciVizDynamicGrid

export interface SciVizFixedGrid extends SciVizGrid {
    type: 'fixed'
    components: { [key: string]: ComponentTypes }
}

export interface SciVizDynamicGrid extends SciVizGrid, SciVizQueried {
    type: 'dynamic'
    route: string
    component_templates: { [key: string]: DynamicGridComponentTypes }
    channels?: string[]
}

interface SciVizGrid {
    type: 'fixed' | 'dynamic'
    columns: number
    row_height: number
}

export type ComponentTypes =
    | DropdownQueryComponent
    | DropdownComponent
    | RadioComponent
    | SliderComponent
    | FormComponent
    | ImageComponent
    | MetadataComponent
    | PlotComponent
    | MarkDownComponent
    | TableComponent
    | SlideshowComponent
    | DateRangePickerComponent
export type DynamicGridComponentTypes = MetadataComponent | PlotComponent

export interface DateRangePickerComponent extends SciVizComponent {
    channel: string
}

export interface DropdownQueryComponent extends SciVizComponent, SciVizQueried {
    channel: string
}

export interface DropdownComponent extends SciVizComponent {
    channel: string
    content: { [key: string]: string }
}

export interface RadioComponent extends SciVizComponent {
    channel: string
    content: { [key: string]: string }
}

export interface SliderComponent extends SciVizComponent, SciVizQueried {
    channel: string
    channels?: string[]
}

export interface SlideshowComponent extends SciVizComponent, SciVizQueried {
    batch_size: number
    chunk_size: number
    buffer_size: number
    max_FPS: number
    channels?: string[]
}

export interface FormComponent extends SciVizComponent {
    tables: string[]
    map?: {
        type: 'attribute' | 'table'
        input: string
        destination: string
        map?: {
            type: 'attribute'
            input: string
            destination: string
        }
    }
    channels?: string[]
}

export interface ImageComponent extends SciVizComponent, SciVizQueried {}

export interface MetadataComponent extends SciVizComponent, SciVizQueried {}

export interface PlotComponent extends SciVizComponent, SciVizQueried {
    channels?: string[]
}

export interface MarkDownComponent extends Omit<SciVizComponent, 'route'> {
    text: string
    image_route?: string
}

export interface TableComponent extends SciVizComponent, SciVizQueried {
    link?: string
    channel?: string
    channels?: string[]
}

interface SciVizQueried {
    restriction: string
    dj_query: string
}

interface SciVizComponent {
    type: string
    route: string
    x: number
    y: number
    height: number
    width: number
}