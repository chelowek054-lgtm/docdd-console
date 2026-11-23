export interface SystemNode {
  ml?: import('../../industry-maps').MlStage;
  id: string;
  title: string;
  kind: string;
  realized_by: string[];
  detail: 'template' | 'detailed';
  reference?: string;
  inputs?: string[];
  outputs?: string[];
  formats?: string[];
  load?: { value: number; unit: string };
  hot_path?: string;
  algorithm?: string;
  language?: string;
  runtime?: string;
  decisions?: string[];
  contract?: string;
}

export interface SystemRelation {
  from: string;
  to: string;
  kind: string;
  label?: string;
}

export interface DevelopmentStandard {
  id: string;
  language: string;
  configs: string[];
  coverage_min?: number;
  coverage_report?: string;
}

export interface SystemDesign {
  nodes: SystemNode[];
  relations: SystemRelation[];
  standards: DevelopmentStandard[];
}

export interface SystemChange {
  added?: Partial<SystemDesign>;
  removed?: {
    nodes?: Pick<SystemNode, 'id'>[];
    relations?: SystemRelation[];
    standards?: Pick<DevelopmentStandard, 'id'>[];
  };
}
