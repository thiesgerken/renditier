import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import { initPerformance } from '../actions/performance';

const Dashboard = ({ performance, onInitPerformance }) => {
  onInitPerformance();

  const formatAmount = value => (value === null ? '' : `${value.toFixed(2)}€`);

  return (
    <table>
      <tr>
        <th rowSpan="2">Zeitraum</th>
        <th colSpan="2">Start</th>
        <th colSpan="2">Ende</th>
        <th rowSpan="2">Gewinn</th>
        <th rowSpan="2">Zinsfuß</th>
      </tr>
      <tr>
        <th>Investiert</th>
        <th>Wert</th>
        <th>Investiert</th>
        <th>Wert</th>
      </tr>
      {performance.map(item => (
        <tr>
          <td>{item.description}</td>

          <td>
            {item.start === null
              ? '\u2014'
              : formatAmount(-1 * item.start.invested)}
          </td>
          <td>
            {item.start === null ? '\u2014' : formatAmount(item.start.value)}
          </td>
          <td>{formatAmount(-1 * item.end.invested)}</td>
          <td>{formatAmount(item.end.value)}</td>
          <td>
            {formatAmount(
              item.end.value +
                item.end.invested -
                (item.start === null
                  ? 0.0
                  : item.start.value + item.start.invested)
            )}
          </td>
          <td>
            {item.irr === null ? '\u2014' : `${(item.irr * 100).toFixed(1)}%`}
          </td>
        </tr>
      ))}
    </table>
  );
};

Dashboard.propTypes = {
  performance: PropTypes.arrayOf(PropTypes.object).isRequired,
  onInitPerformance: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  onInitPerformance: () => dispatch(initPerformance()),
});

const mapStateToProps = ({ performance }) => ({
  performance: performance.items,
});

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
