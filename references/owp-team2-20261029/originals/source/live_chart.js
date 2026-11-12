import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import isEmpty from 'lodash/isEmpty';
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { mutate, query } from '@owp/api';
import orderBy from 'lodash/orderBy';
import moment from 'moment-timezone';
import get from 'lodash/get';
import uniqueId from 'lodash/uniqueId';
/*
    Location    : livechart 구현
    Deacriptin  : livechart 구현
    FileName    : live-chart.js
    Author      : mj.kim
    Date        : 2020.06.23
    Work        : 라이브 차트 구현 진행 중 (상한치, 하안치 값 등등 데이터 확인 작업 진행 중 ).

*/

am4core.useTheme(am4themes_animated);
am4core.options.commercialLicense = true;

const BLUE = '#1a9eea';
const RED = '#ff0080';

const ZERO_POINT_ZERO = '0.0';

async function makeChartData({
    tid = 'DRYER_E201PV', //넘겨온값들 받기
    date = '2020-06-25',
    time = '16:49',
    limitRow = '500',
    timeRow = '0',
} = {}) {
    try {
        return (
            (await query({
                url: 'selectPredictiveMaintenance',
                params: {
                    jsondata: JSON.stringify({
                        TID: tid.toString(),
                        Date: date.toString(),
                        Time: time.toString(),
                        LimitRow: limitRow.toString(),
                        TimeRow: timeRow.toString(),
                    }),
                },
            })) || []
        );
    } catch (error) {
        console.error(error);
    }
}

function updateChartData({ chart, yAxes, range } = {}, data = []) {
    try {
        if (isEmpty(chart) || isEmpty(yAxes)) {
            return;
        }
        chart.data = data;
        updateReferenceLineDataOfChart(range, get(data, 0, {}));
    } catch (error) {
        console.error(error);
    }
}
// 상한선, 하한선, 중앙선
function updateReferenceLineDataOfChart(range, data) {
    if (isEmpty(range)) {
        return;
    }

    ['lsl', 'usl', 'cl'].forEach(key => {
        const targetRange = get(range, key, {});
        targetRange.value =
            key === 'cl'
                ? (range.lsl.value + range.usl.value) / 2.0
                : parseFloat(get(data, key, get(data, `${key}1`, 0)));
    });
}
//create chart 
const createChart = id =>{
    if (!id) {
        return;
    }
    const chart = am4core.create(id, am4charts.XYChart);
    chart.dateFormatter.dateFormat = 'yyyy-MM-dd HH:mm:ss.nnn';
    chart.zoomOutButton.disabled = true;
    
    let data = [];
    let visits = 10;
    let i = 0;        

    for (i = 0; i <= 30; i++) {
        visits -= Math.round((Math.random() < 0.5 ? 1 : -1) * Math.random() * 10);
        data.push({ date: new Date().getTime() , value: visits });
    }

    //LIVECHART 추가 
    chart.data = data;

    // Create axes
    const dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.minGridDistance = 50;
    // dateAxis.dateFormatter = new am4core.DateFormatter();
    // dateAxis.dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss.nnn";
    // Set date label formatting
    dateAxis.dateFormats.setKey('hour', '[bold]mm a');

    dateAxis.periodChangeDateFormats.setKey("second", "[bold]h:mm a");
    dateAxis.periodChangeDateFormats.setKey("minute", "[bold]h:mm a");
    dateAxis.periodChangeDateFormats.setKey("hour", "[bold]h:mm a");
    
    const yAxes = chart.yAxes.push(new am4charts.ValueAxis());
    yAxes.fontWeight = 'bold';
    yAxes.title.fill = '#D21819';
    yAxes.rangeChangeDuration = 500;
    //LIVECHART 추가 
    yAxes.tooltip.disabled = true;
    yAxes.interpolationDuration = 5; // 변동 폭 상태
    yAxes.rangeChangeDuration = 5; //바뀌는 case 
    yAxes.renderer.inside = true;
    yAxes.renderer.minLabelPosition = 0.05;
    yAxes.renderer.maxLabelPosition = 0.95;
    yAxes.renderer.axisFills.template.disabled = true;
    yAxes.renderer.ticks.template.disabled = true;
    
    // Create series
    const series = chart.series.push(new am4charts.LineSeries());
    series.showOnInit = true;
    series.dataFields.valueY = 'value';
    series.dataFields.dateX = 'date';
    series.strokeWidth = 2;
    series.minBulletDistance = 10;
    series.tooltipText = "{valueY} : {dateX.formatDate('yyyy-MM-dd HH:mm:ss.nnn')}";
    series.tooltip.pointerOrientation = 'vertical';
    series.tooltip.animationDuration = 500;
    series.tooltip.background.cornerRadius = 20;
    series.tooltip.background.fillOpacity = 0.5;
    series.tooltip.label.padding(12, 12, 12, 12);
    series.propertyFields.stroke = 'lineColor';
    
    //LIVE CHART 추가 
    series.interpolationDuration = 5;
    series.defaultState.transitionDuration = 0;
    series.tensionX = 1.5; //0.8
    
    chart.events.on("datavalidated", function () {
        dateAxis.zoom({ start: 1 / 15, end: 1.2 }, false, true);
    });

    dateAxis.interpolationDuration = 500;
    dateAxis.rangeChangeDuration = 500;

    // Add cursor
    //chart.cursor = new am4charts.XYCursor();
    //chart.cursor.xAxis = dateAxis;
    //chart.cursor.snapToSeries = series;
    
    //CHART 추가 
    let interval;

    function startInterval() {
        interval = setInterval(function() {
            updateChartData();
        }, 1000);
    }

    startInterval();
    
    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            if (interval) {
                clearInterval(startInterval);
            }
        }
        else {
            startInterval();
        }
    }, false);
    
    //실시간 이동하면서 그릴 0 표시 
    let bullet = series.createChild(am4charts.CircleBullet);
    bullet.circle.radius = 5;
    bullet.fillOpacity = 1;
    bullet.fill = chart.colors.getIndex(0);
    bullet.isMeasured = false;
    
    console.log("series.dataFields.valueY" , series.dataFields.valueY);
    series.events.on("validated", function() {
        bullet.moveTo(10); //series.dataItems.last.point
        bullet.validatePosition();
    });
    
    return {chart, series, yAxes} /*, range: { lsl, usl, cl }*/
}

const LiveChart = ({
    id,
    tid,
    date,
    time,
    limitRow,
    timeRow,
} = {}) => {
    const [chart, setChart] = useState();
    const [inputs, setInput] = useState({});
    const [chartData, setChartData] = useState([]);

    const nextChartData = useMemo(
        () =>
            orderBy(
                chartData.map(item => {
                    const date = moment(item.timestamp)
                        .tz('Asia/Seoul')
                        .toDate();
                    const value = parseFloat(item.value);
                    return {
                        date,
                        value
                    };
                }),
                ['date']
            ) || [],
        [chartData]
    );

    // Create chart instance
    useEffect(() => {
        const chartInstance = createChart(id);
        setChart(chartInstance);

        console.log("chartInstance", chartInstance);

        return () => {
            if (!!get(chartInstance, 'chart')) {
                chartInstance.chart.dispose();
            }
        };
    }, [id]);

    useEffect(() => {
        let isUnmount = false;
        async function updateChartData() {
            try {
                const data =
                    (await makeChartData({
                        tid,
                        date,
                        time,
                        limitRow,
                        timeRow,
                    })) || [];

                setChartData(data);
                console.log("data::::::::" , data);

                if (isEmpty(inputs)) {
                    setInput({
                        lsl: get(data, '0.lsl1', ZERO_POINT_ZERO),
                        usl: get(data, '0.usl1', ZERO_POINT_ZERO),
                    });
                }
            } catch (error) {
                console.error(error);
            }
        }
        if (!isUnmount) {
            updateChartData();
        }
        return () => {
            isUnmount = true;
        };
    }, [tid, date, time, limitRow, timeRow]);

    useEffect(() => {
        if (!isEmpty(chart)) {
            updateChartData(chart, nextChartData);
        }
    }, [chart, nextChartData]);

    return (
        <div id={id} style={{ height: '100%' }} />
    );
};

 
LiveChart.propTypes = {
    tid: PropTypes.string,
    date: PropTypes.string,
    time: PropTypes.string,
    limitRow: PropTypes.string,
    timeRow: PropTypes.string
};

LiveChart.defaultProps = {
    tid: '',
    date: '',
    time: '',
    limitRow: '',
    timeRow: ''
};

export default LiveChart;

