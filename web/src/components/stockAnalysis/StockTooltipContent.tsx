// from recharts.js, modified

import _ from 'lodash';
import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import classNames from 'classnames';
import moment from 'moment';
import type { DefaultTooltipContentProps } from 'recharts';

import type { StoredStockPlotPoint } from '../../types/store';

// recharts clones this element with the tooltip content props, all of which are
// optional; only `showPriceDate` is passed by StockPlot itself.
interface Props extends DefaultTooltipContentProps {
  showPriceDate: boolean;
}

const isNumber = (value: unknown): boolean =>
  _.isNumber(value) && !_.isNaN(value);
const isNumOrStr = (value: unknown): boolean =>
  isNumber(value) || _.isString(value);

const StockTooltipContent = ({
  showPriceDate,
  payload,
  separator = ' : ',
  formatter,
  itemStyle = {},
  itemSorter,
  wrapperClassName,
  contentStyle = {},
  labelClassName,
  labelStyle = {},
  label,
  labelFormatter,
}: Props) => {
  const renderContent = () => {
    if (payload && payload.length) {
      const listStyle: CSSProperties = { padding: 0, margin: 0 };

      const items = (itemSorter ? _.sortBy(payload, itemSorter) : payload).map(
        (entry, i) => {
          if (entry.type === 'none') {
            return null;
          }

          const finalItemStyle: CSSProperties = {
            display: 'block',
            paddingTop: 4,
            paddingBottom: 4,
            color: entry.color || '#000',
            ...itemStyle,
          };
          const finalFormatter = entry.formatter || formatter;
          const { name, value } = entry;
          // The formatter may replace name/value with arbitrary nodes, which is
          // wider than the `NameType` / `ValueType` recharts declares on `entry`.
          let finalName: ReactNode = name;
          let finalValue: ReactNode = value;
          if (finalFormatter) {
            const formatted = finalFormatter(value, name, entry, i, payload);
            if (Array.isArray(formatted)) {
              [finalValue, finalName] = formatted;
            } else {
              finalValue = formatted;
            }
          }
          return (
            <li
              className="recharts-tooltip-item"
              key={`tooltip-item-${i}`}
              style={finalItemStyle}
            >
              {isNumOrStr(finalName) ? (
                <span className="recharts-tooltip-item-name">{finalName}</span>
              ) : null}
              {isNumOrStr(finalName) ? (
                <span className="recharts-tooltip-item-separator">
                  {separator}
                </span>
              ) : null}
              <span className="recharts-tooltip-item-value">{finalValue}</span>
              <span className="recharts-tooltip-item-unit">
                {entry.unit || ''}
              </span>
            </li>
          );
        }
      );

      return (
        <ul className="recharts-tooltip-item-list" style={listStyle}>
          {items}
        </ul>
      );
    }

    return null;
  };

  const finalStyle: CSSProperties = {
    margin: 0,
    padding: 10,
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    whiteSpace: 'nowrap',
    ...contentStyle,
  };
  const finalLabelStyle: CSSProperties = {
    margin: 0,
    ...labelStyle,
  };
  const hasLabel = !_.isNil(label);
  let finalLabel: ReactNode = hasLabel ? label : '';
  const wrapperCN = classNames('recharts-default-tooltip', wrapperClassName);
  const labelCN = classNames('recharts-tooltip-label', labelClassName);

  if (hasLabel && labelFormatter) {
    // recharts always passes `payload` alongside `label`; the fallback only
    // exists because the prop is declared optional.
    finalLabel = labelFormatter(label, payload ?? []);
  }

  // recharts types each entry's `payload` as `any`; on this chart the data
  // points are the ones the stockPlot thunk stores.
  const point = payload?.[0]?.payload as StoredStockPlotPoint | undefined;

  return (
    <div className={wrapperCN} style={finalStyle}>
      <p className={labelCN} style={finalLabelStyle}>
        {React.isValidElement(finalLabel) ? finalLabel : `${finalLabel}`}
      </p>
      {renderContent()}
      {showPriceDate && payload && payload.length && point?.priceDate && (
        <span style={{ paddingTop: 6 }}>
          {`Kursdatum: ${moment(point.priceDate).format('L LT')}`}
        </span>
      )}
    </div>
  );
};

export default StockTooltipContent;
