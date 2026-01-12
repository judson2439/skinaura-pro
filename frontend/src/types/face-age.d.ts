declare module 'face-age' {
  interface FaceAgeOptions {
    elementId?: string;
    faceageId: string;
    displayModel?: 'widget' | 'section' | 'modal';
    language?: string;
    width?: string | number;
    height?: string | number;
    currency?: string;
    quiz?: boolean;
    defaultQuiz?: { email?: string; [key: string]: unknown };
    showProducts?: boolean;
    showRoutine?: boolean;
    showAddToCart?: boolean;
    showCamera?: boolean;
    showUpload?: boolean;
    problems?: string[];
    routinesSupport?: string[];
  }

  interface FaceAgeAPI {
    getAdvisorData(callback: (data: unknown) => void): void;
    getActiveSelections(callback: (data: unknown) => void): void;
    getImage(): string | null;
    getRoutineGroup(): unknown;
    setCustomProducts(products: unknown[]): void;
  }

  class FaceAge {
    constructor(options: FaceAgeOptions);
    API: FaceAgeAPI;
    render(): void;
    onClickProblem(callback: (key: string) => void): void;
    onDisplayProducts(callback: (data: unknown) => void): void;
    onDisplayRoutines(callback: (data: unknown) => void): void;
    onAddToCart(callback: (data: unknown) => void): void;
    onClickProduct(callback: (product: unknown) => void): void;
    onResetData(callback: () => void): void;
    onCloseModal(callback: () => void): void;
    onCheckout(callback: (data: unknown) => void): void;
  }

  export default FaceAge;
}

declare module 'react-face-age' {
  import { ComponentType } from 'react';

  interface ReactFaceAgeProps {
    options: {
      faceageId: string;
      type?: string;
      [key: string]: unknown;
    };
    onLoad?: (result: unknown) => void;
  }

  const ReactFaceAge: ComponentType<ReactFaceAgeProps>;
  export default ReactFaceAge;
}
