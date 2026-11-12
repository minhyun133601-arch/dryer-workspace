import _ from '@lodash';
import { withStyles } from '@material-ui/core/styles';
import { query } from '@owp/api';
import React from 'react';
import { Animated } from 'react-animated-css';
//import Clock from 'react-live-clock';
import { BigPlayButton, ControlBar, Player } from 'video-react';
import './video.css';
import GuageChart from './chart_guage';
import LiveChart from './live_chart';
import { makeNowHHmm, makeNowYYYYMMDD } from '@owp/common';
/*
    Location    : 실시간 공정현황>3D 영상
    Deacriptin  : 영상화면1
    FileName    : video.js
    Author      : sy.oh
    Date        : 2020.04.09
    Work        : 영상 중 [ICA1~3, X-ray1~3] 공정 부분을 매핑함.
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
    pellerar: '/assets/models/heechang_0428_3F4F.webm',
};

const MS_60000 = 60000;

class Video34 extends React.Component {
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
            //usl, lsl 관련1
            usl: 0,
            lsl: 0,
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
                result = res;
                result.map((item) => {
                    if (_.includes(item.TID, 'DRYER_')) {
                        let _value = Math.abs(Number(item.VALUE));
                        _value = _value.toFixed(3);

                        this.setState({
                            [item.TID + '_Value']: this.numberFormat(_value),
                            [item.TID + '_Name']: item.SENSORNM,
                            //상한치, 하안치 값
                            [item.TID + '_USL1']: Number(item.USL1),
                            [item.TID + '_LSL1']: Number(item.LSL1),
                            [item.TID + '_Value1']: item.TID,
                            [item.TID + '_TIMESTAMP']: item.TIMESTAMP,
                            [item.TID + '_TID']: item.TID,
                        });
                    }
                });
            })
            .catch((error) => console.error('error...', error));
    };

    dataLoadLoop = null;

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
        clearInterval(this.liveLoadLoop);
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
                style={{
                    marginLeft: '120px',
                    marginTop: '-100px',
                }}
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

                            <div className="OP-VAL-DRYER_E201PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E201PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E201PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E201PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E201PV_Value'],
                                            usl: this.state['DRYER_E201PV_USL1'],
                                            lsl: this.state['DRYER_E201PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm" onClick={this.liveLoad}>
                                        V/F진공 {this.state._USL}
                                    </div>
                                    <div className="val g"> {this.state['DRYER_E201PV_Value']}</div>
                                    <div className="unit">mmWG</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E201PV) && drawTable}
                            </div>

                            <div className="OP-VAL-DRYER_E206PV labelvalue_1_glass">
                                <div
                                    className="GuageChart"
                                    onMouseOver={() => {
                                        this.settingBubble(this.state['DRYER_E206PV_TID']);
                                    }}
                                    onMouseOut={() => {
                                        this.resetBubble(this.state['DRYER_E206PV_TID']);
                                    }}
                                >
                                    <GuageChart
                                        id="DRYER_E206PV_GuageChart"
                                        data={{
                                            val: this.state['DRYER_E206PV_Value'],
                                            usl: this.state['DRYER_E206PV_USL1'],
                                            lsl: this.state['DRYER_E206PV_LSL1'],
                                        }}
                                    />
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">화인리턴</div>
                                    <div className="val g">{this.state['DRYER_E206PV_Value']}</div>
                                    <div className="unit">mmWG</div>
                                </div>
                                {Boolean(this.state.bubbleDRYER_E206PV) && drawTable}
                            </div>
                        </Animated>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(Video34);
