import * as am4charts from '@amcharts/amcharts4/charts';
import * as am4core from '@amcharts/amcharts4/core';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';
import isEmpty from 'lodash/isEmpty';
import React, { useEffect, useState } from 'react';
import uniqueId from 'lodash/uniqueId';

am4core.useTheme(am4themes_animated);
am4core.options.commercialLicense = true;

function GuageChart({ id, data }) {
    const [chart, setChart] = useState();
    useEffect(() => {

        // create chart
        const chart = am4core.create(id, am4charts.GaugeChart);
        chart.innerRadius = -20;

        let axis = chart.xAxes.push(new am4charts.ValueAxis());
        chart.axis = axis ;
        axis.strictMinMax = true;

        // axis.renderer
        axis.renderer.labels.template.disabled = true;

        let colorSet = new am4core.ColorSet();

        let range0 = axis.axisRanges.create();
        chart.range0 = range0 ;
        range0.axisFill.fillOpacity = 1;
        range0.axisFill.fill = am4core.color("#ffe000");//colorSet.getIndex(0);

        let range1 = axis.axisRanges.create();
        chart.range1 = range1 ;
        range1.axisFill.fillOpacity = 1;
        range1.axisFill.fill = am4core.color("#0f9c00");//colorSet.getIndex(2);

        var range2 = axis.axisRanges.create();
        chart.range2 = range2 ;
        range2.axisFill.fillOpacity = 1;
        range2.axisFill.fill = am4core.color("#ff5100");//colorSet.getIndex(4);

        let hand = chart.hands.push(new am4charts.ClockHand());
        chart.hand = hand ;

        setChart(chart);

        return () => {
            chart.dispose();
        };
    }, [id]);

    useEffect(() => {
        if (!isEmpty(chart) && !!data ) {



            chart.data = data;



            //적정
            let range1_min = data.lsl * 1000;
            let range1_max = data.usl * 1000;
            let section = range1_max - range1_min;

            //적정 이하구간
            let range0_min = range1_min - section;
            let range0_max =  range1_max -  section;

            //위험 구간
            let range2_min = range1_min + section;
            let range2_max = range1_max + section;

            let axis_min = range0_min;
            let axis_max = range2_max;

            chart.axis.min = axis_min;
            chart.axis.max = axis_max;

            chart.range0.value = range0_min;
            chart.range0.endValue = range0_max;

            chart.range1.value = range1_min;
            chart.range1.endValue = range1_max;

            chart.range2.value = range2_min;
            chart.range2.endValue = range2_max;

            chart.hand.showValue(data.val * 1000 , 1000, am4core.ease.cubicOut);
        }
    }, [chart, data.val ]);

    return <div id={id} style={{ height: '100%' }} />;
}
GuageChart.defaultProps = {
    id: `guage-chart-${uniqueId()}`,
    data: 0,
};
export default GuageChart;

