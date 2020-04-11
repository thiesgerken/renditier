// from recharts.js, modified

import _ from 'lodash';
import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import * as moment from 'moment';

const isNumber = value => _.isNumber(value) && !_.isNaN(value);
const isNumOrStr = value => isNumber(value) || _.isString(value);

const StockTooltipContent = ({
  showPriceDate,
  payload,
  separator,
  formatter,
  itemStyle,
  itemSorter,
  wrapperClassName,
  contentStyle,
  labelClassName,
  labelStyle,
  label,
  labelFormatter,
}) => {
  const renderContent = () => {
    if (payload && payload.length) {
      const listStyle = { padding: 0, margin: 0 };

      const items = (itemSorter ? _.sortBy(payload, itemSorter) : payload).map(
        (entry, i) => {
          if (entry.type === 'none') {
            return null;
          }

          const finalItemStyle = {
            display: 'block',
            paddingTop: 4,
            paddingBottom: 4,
            color: entry.color || '#000',
            ...itemStyle,
          };
          const finalFormatter = entry.formatter || formatter;
          let { name, value } = entry;
          if (finalFormatter) {
            const formatted = finalFormatter(value, name, entry, i, payload);
            if (Array.isArray(formatted)) {
              [value, name] = formatted;
            } else {
              value = formatted;
            }
          }
          return (
            // eslint-disable-next-line react/no-array-index-key
            <li
              className="recharts-tooltip-item"
              key={`tooltip-item-${i}`}
              style={finalItemStyle}
            >
              {isNumOrStr(name) ? (
                <span className="recharts-tooltip-item-name">{name}</span>
              ) : null}
              {isNumOrStr(name) ? (
                <span className="recharts-tooltip-item-separator">
                  {separator}
                </span>
              ) : null}
              <span className="recharts-tooltip-item-value">{value}</span>
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

  const finalStyle = {
    margin: 0,
    padding: 10,
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    whiteSpace: 'nowrap',
    ...contentStyle,
  };
  const finalLabelStyle = {
    margin: 0,
    ...labelStyle,
  };
  const hasLabel = !_.isNil(label);
  let finalLabel = hasLabel ? label : '';
  const wrapperCN = classNames('recharts-default-tooltip', wrapperClassName);
  const labelCN = classNames('recharts-tooltip-label', labelClassName);

  if (hasLabel && labelFormatter) {
    finalLabel = labelFormatter(label, payload);
  }

  return (
    <div className={wrapperCN} style={finalStyle}>
      <p className={labelCN} style={finalLabelStyle}>
        {React.isValidElement(finalLabel) ? finalLabel : `${finalLabel}`}
      </p>
      {renderContent()}
      {showPriceDate &&
        payload &&
        payload.length &&
        payload[0].payload.priceDate && (
          <span style={{ paddingTop: 6 }}>
            {`Kursdatum: ${moment(payload[0].payload.priceDate).format(
              'L LT'
            )}`}
          </span>
        )}
    </div>
  );
};

StockTooltipContent.defaultProps = {
  separator: ' : ',
  contentStyle: {},
  itemStyle: {},
  labelStyle: {},
  labelFormatter: null,
  wrapperClassName: null,
  labelClassName: null,
  formatter: null,
  label: null,
  payload: null,
  itemSorter: null,
};

StockTooltipContent.propTypes = {
  showPriceDate: PropTypes.bool.isRequired,
  separator: PropTypes.string,
  wrapperClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  formatter: PropTypes.func,
  contentStyle: PropTypes.shape([]),
  itemStyle: PropTypes.shape([]),
  labelStyle: PropTypes.shape([]),
  labelFormatter: PropTypes.func,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  payload: PropTypes.arrayOf(PropTypes.object),
  itemSorter: PropTypes.string,
};

export default StockTooltipContent;
