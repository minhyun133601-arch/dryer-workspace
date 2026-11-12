import _ from '@lodash';
import { withStyles } from '@material-ui/core/styles';
import { query } from '@owp/api';
import React from 'react';
import { Animated } from 'react-animated-css';
//import Clock from 'react-live-clock';
import { BigPlayButton, ControlBar, Player } from 'video-react';
import './video.css';
import GuageChart from './chart_guage';

/*
    Location    : 실시간 공정현황>3D 영상
    Deacriptin  : 영상화면1
    FileName    : video.js
    Author      : sy.oh
    Date        : 2020.04.09
    Work        : 영상 중 [ICA1~3, X-ray1~3] 공정 부분을 매핑함.
    Work1       : 영상 중 [챔버입구 ~ SSA] 공정 부분을 매핑함. (mjkim)
    Work2       : 희창유업 생산팀 실적현황 UI  및 데이터 연동함. (mjkim)
    Work3       : 희창유업 생산팀 실적현황 UI 및 데이터 연동 관련 된 내용을 삭제 함 (mjkim)
*/

const styles = (theme) => ({
    popover: {
        pointerEvents: 'none',
    },
    paper: {
        padding: theme.spacing.unit,
    },
});

const sources = {
    pellerar: '/assets/models/heechang_0428_5F7F.webm',
};

//20200619 작업
class Video57 extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            source: sources.pellerar,
            lineRun: 0,
            lineIdle: 0,
            lineStop: 0,
            lineOff: 0,
            anchorEl: null,
            erpData: {},
            showlabel: false,
            total: [],
            cnt: [],
        };

        this.play = this.play.bind(this);
        this.pause = this.pause.bind(this);
        this.load = this.load.bind(this);
        this.changeCurrentTime = this.changeCurrentTime.bind(this);
        this.seek = this.seek.bind(this);
    }

    numberFormat(inputNumber) {
        return inputNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    dataLoad = () => {
        let result = {};
        query({
            url: '/selectC101000Monitering_MACHBASE',
            params: {
                jsondata: '{}',
            },
        })
            .then((res) => {
                // console.log(result)1;
                result = res;
                result.map((item) => {
                    //console.log(item.SENSORNM,item.TID, item.VALUE);
                    // console.log(_.includes(item.TID, '_Count'));

                    if (_.includes(item.TID, 'DRYER_')) {
                        let _value = Math.abs(Number(item.VALUE));
                        _value = _value.toFixed(3);
                        this.setState({
                            [item.TID + '_Value']: this.numberFormat(_value),
                            [item.TID + '_Name']: item.SENSORNM,
                            //상한치, 하안치 값
                            [item.TID + '_USL1']: Number(item.USL1),
                            [item.TID + '_LSL1']: Number(item.LSL1),
                            [item.TID + '_TIMESTAMP']: item.TIMESTAMP,
                            [item.TID + '_TID']: item.TID,
                        });
                    }
                });
            })
            .catch((error) => console.error('error...', error));
    };

    dataLoadLoop = null;
    //datatotalLoop = null;

    componentDidMount() {
        // subscribe state change
        this.player.subscribeToStateChange(this.handleStateChange.bind(this));

        const innerWidth = window.innerWidth;
        //console.log('innerWidth',innerWidth);
        this.setState({ innerWidth: innerWidth });
        this.setState({ zoomRatio: (innerWidth / 1920) * 100 });

        this.dataLoad();

        const dataLoad = () => {
            if (this.props.play) this.dataLoad();
        };
        this.dataLoadLoop = window.setInterval(() => {
            dataLoad();
        }, 2000);
    }

    componentWillUnmount() {
        clearInterval(this.dataLoadLoop);
        clearInterval(this.datatotalLoop); //현황판 집계
    }

    showlabel = false;
    paused = true;
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.state.player) {
            // console.log(this.state.player.currentTime);
            // console.log('this.showlabel',this.showlabel);
            // console.log('this.state.showlabel',this.state.showlabel);
            // console.log('this.props.play',this.props.play);
            // console.log('this.paused',this.paused);

            if (this.props.play === true && this.state.player.currentTime === 0) {
                this.play();
                this.paused = false;
                this.showlabel = false;
            }

            if (this.props.play === false && this.state.player.currentTime > 0) {
                //this.seek(0);
                this.player.seek(0);
                this.player.pause();
                console.log('this.player.pause()');
                this.paused = true;
                this.showlabel = false;
            }

            if (this.showlabel === true && this.state.showlabel === false) {
                this.setState({ showlabel: true });
            } else if (this.showlabel === false && this.state.showlabel === true) {
                this.setState({ showlabel: false });
            }

            if (
                this.props.play === true &&
                this.showlabel === false &&
                this.state.player.currentTime > 3
            ) {
                this.showlabel = true;
                this.setState({ showlabel: true });
            }

            if (
                this.showlabel === true &&
                this.state.showlabel === true &&
                this.state.player.currentTime > 8.9
            ) {
                this.player.seek(3);
            }

            // if(this.state.player.duration===this.state.player.currentTime){
            //     this.seek(0);
            //     this.play();
            //     this.showlabel = false ;
            // }
        }
    }

    setMuted(muted) {
        return () => {
            this.player.muted = muted;
        };
    }

    handleStateChange(state) {
        // copy player state to this component's state
        this.setState({
            player: state,
            //currentTime: state.currentTime
        });
    }

    play() {
        this.player.play();
    }

    pause() {
        this.player.pause();
    }

    load() {
        this.player.load();
    }

    changeCurrentTime(seconds) {
        return () => {
            const { player } = this.player.getState();
            this.player.seek(player.currentTime + seconds);
        };
    }

    seek(seconds) {
        return () => {
            this.player.seek(seconds);
        };
    }

    settingBubble = (Euq) => {
        //데이터에 올렸을때 테이블 표시하기
        this.setState({
            ['bubble' + Euq]: true,
            saveEuqTime: this.state[Euq + '_TIMESTAMP'],
        });
    };

    resetBubble = (Euq) => {
        //내렸을때 테이블 닫기
        this.setState({
            ['bubble' + Euq]: false,
            saveEuqTime: '',
        });
    };

    render() {
        const drawTable = (
            <table
                className="blueTable2"
            // style={{
            //   marginLeft: "120px",
            //   marginTop: "-100px",
            // }}
            >
                <tbody>
                    <tr>
                        <td>{this.state.saveEuqTime}</td>
                    </tr>
                </tbody>
            </table>
        );
        return (
            <React.Fragment>
                <div style={{ position: 'relative', width: `${this.state.innerWidth}px` }}>
                    <Player
                        ref={(player) => {
                            this.player = player;
                        }}
                        // autoPlay
                        muted
                        // loop
                        LoadingSpinner={null}
                    >
                        <source src={this.state.source} />
                        <ControlBar
                            disableDefaultControls={true}
                            autoHide={true}
                            autoHideTime={1}
                        />
                        <BigPlayButton position="center" />
                    </Player>
                    <div
                        className="Light"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zoom: `${this.state.zoomRatio}%`,
                        }}
                    >
                        <Animated
                            animationIn="fadeIn"
                            animationOut="fadeOut"
                            animationInDuration={1500}
                            animationOutDuration={800}
                            animateOnMount={false}
                            isVisible={this.state.showlabel}
                        >
                            <div className="clock">

                            </div>

                            <div className="OP-VAL-DRYER_V600CV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_V600CV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_V600CV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_V600CV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_V600CV_Value'],
                                            usl: this.state['DRYER_V600CV_USL1'],
                                            lsl: this.state['DRYER_V600CV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">메인송풍량</div>
                                    <div className="val g">{this.state['DRYER_V600CV_Value']}</div>
                                    <div className="unit">%</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_V600CV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_E101PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E101PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E101PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E101PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E101PV_Value'],
                                            usl: this.state['DRYER_E101PV_USL1'],
                                            lsl: this.state['DRYER_E101PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">챔버출구온도</div>
                                    <div className="val g">{this.state['DRYER_E101PV_Value']}</div>
                                    <div className="unit">℃</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E101PV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_E107PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E107PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E107PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E107PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E107PV_Value'],
                                            usl: this.state['DRYER_E107PV_USL1'],
                                            lsl: this.state['DRYER_E107PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">V/F출구온도</div>
                                    <div className="val g">{this.state['DRYER_E107PV_Value']}</div>
                                    <div className="unit">℃</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E107PV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_X100PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_X100PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_X100PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_X100PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_X100PV_Value'],
                                            usl: this.state['DRYER_X100PV_USL1'],
                                            lsl: this.state['DRYER_X100PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">SSA</div>
                                    <div className="val g">{this.state['DRYER_X100PV_Value']}</div>
                                    <div className="unit">kg/h</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_X100PV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_E100CV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E100CV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E100CV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E100CV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E100CV_Value'],
                                            usl: this.state['DRYER_E100CV_USL1'],
                                            lsl: this.state['DRYER_E100CV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">가스량</div>
                                    <div className="val g">{this.state['DRYER_E100CV_Value']}</div>
                                    <div className="unit">%</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E100CV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_E200PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E200PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E200PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E200PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E200PV_Value'],
                                            usl: this.state['DRYER_E200PV_USL1'],
                                            lsl: this.state['DRYER_E200PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">챔버진공값</div>
                                    <div className="val g">{this.state['DRYER_E200PV_Value']}</div>
                                    <div className="unit">kg/h</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E200PV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_E100PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E100PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E100PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E100PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E100PV_Value'],
                                            usl: this.state['DRYER_E100PV_USL1'],
                                            lsl: this.state['DRYER_E100PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">챔버입구온도</div>
                                    <div className="val g">{this.state['DRYER_E100PV_Value']}</div>
                                    <div className="unit">℃</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E100PV) && drawTable}
                            </div>
                        </Animated>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(Video57);
