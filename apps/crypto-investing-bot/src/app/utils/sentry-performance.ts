import { startInactiveSpan } from '@sentry/node';

export function WithSentryPerformance(description?: string) {
  return function (
    target: unknown,
    propertyName: string,
    propertyDesciptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = propertyDesciptor.value;
    const methodName = propertyName; // Имя метода, к которому применяется декоратор

    propertyDesciptor.value = function (...args: unknown[]) {
      const transactionContext = {
        name: methodName,
        op: methodName, // Используем имя метода как op
        description: description || `Method ${methodName} execution`, // Позволяем задать описание или используем стандартное
      };
      const span = startInactiveSpan(transactionContext);
      let isPromise = false;
      try {
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          isPromise = true;
          return result.finally(() => span.end());
        } else {
          span.end();
          return result;
        }
      } catch (error) {
        span.setStatus('internal_error');
        throw error;
      } finally {
        // Завершаем span без проверки на isFinished
        if (!isPromise) {
          span.end();
        }
      }
    };

    return propertyDesciptor;
  };
}
