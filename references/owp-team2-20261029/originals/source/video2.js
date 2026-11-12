import _ from '@lodash';
import { withStyles } from '@material-ui/core/styles';
import { query } from '@owp/api';
import React from 'react';
import { Animated } from 'react-animated-css';
//import Clock from 'react-live-clock';
import { BigPlayButton, ControlBar, Player } from 'video-react';
import './video.css';
import DialogList from './Dialog_List';
import moment from 'moment';

/*
    Location    : 실시간 공정현황>3D 영상
    Deacriptin  : 영상화면1
    FileName    : video.js
    Author      : sy.oh
    Date        : 2020.04.09
    Work        : 영상 중 [ICA1~3, X-ray1~3] 공정 부분을 매핑함.
    Work1       : 이카1,2,3 호기 및 해당 전처리실 버튼 클릭시 상세 정보 조회 매핑.
*/

const RATE_LIMIT = 40;

const styles = (theme) => ({
    popover: {
        pointerEvents: 'none',
    },
    paper: {
        padding: theme.spacing.unit,
    },
});

const sources = {
    pellerar: '/assets/models/heechang_0425_1F.webm',
};

class Video1 extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            source: sources.pellerar,
            showlabel: false,
            total: [],
            TAG_NM: '', //세부정보 데이터 조회
            ICA2_Total_Count_Value: '',
            ICA3_Total_Count_Value: '',
            ICA3_Xray_Ng_Count_Value: '',
            table: [],
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

    clearprops = () => {
        this.setState({
            TAG_NM: '',
        });
    };

    dataLoad = () => {
        query({
            url: '/listOWP_C402060_MAIN_VI2',
            params: {
                jsondata: JSON.stringify({
                    'OWP_C402060_MAIN_VI.WORK_AREA': 'D028029',
                }),
            },
        }).then((res) => {
            if (!!res) {
                res.map((item, i) => {
                    // if (_.includes(item["OWP_C402060_MAIN_VI.CODENM"], "ICA" || "지대")) {1
                    this.setState({
                        [i + 1 + '_PROD']: item['OWP_C402060_MAIN_VI.PROD_NM'], //제품명
                        [i + 1 + '_USERNAME']: item['OWP_C402060_MAIN_VI.USERNAME'], //작업자
                        [i + 1 + '_WORK_START_TIME']: item['OWP_C402060_MAIN_VI.WORK_START_TIME'], //시작시간
                    });
                    // }
                });
            }
        });

        this.dataIcaLoad(this.state['1_WORK_START_TIME'], 'ICA1'); //ICA1+ XRAY1
        this.dataIcaLoad(this.state['2_WORK_START_TIME'], 'ICA2'); //ICA2+ XRAY2
        this.dataIcaLoad(this.state['3_WORK_START_TIME'], 'ICA3'); //ICA3+ XRAY3
        this.dataIcaLoad(this.state['4_WORK_START_TIME'], 'JIDAE'); //지대+ 금속검출기

        this.dataBoxLoad(this.state['1_WORK_START_TIME'], this.state['2_WORK_START_TIME'], '1'); //박스1
        this.dataBoxLoad(this.state['3_WORK_START_TIME'], this.state['2_WORK_START_TIME'], '2'); //박스2

        // 적재 ICA1,2,3 데이터가 없을때 서비스 실행 안함
        if (
            this.state['1_WORK_START_TIME'] !== undefined ||
            this.state['2_WORK_START_TIME'] !== undefined ||
            this.state['3_WORK_START_TIME'] !== undefined ||
            this.state['4_WORK_START_TIME'] !== undefined
        ) {
            query({
                url: '/selectC101000Monitering_MACHBASE_CONV',
                params: {
                    jsondata: JSON.stringify({
                        ICA1_START_TIME: this.state['1_WORK_START_TIME'],
                        ICA2_START_TIME: this.state['2_WORK_START_TIME'],
                        ICA3_START_TIME: this.state['3_WORK_START_TIME'],
                        JIDAE_START_TIME: this.state['4_WORK_START_TIME'],
                    }),
                },
            })
                .then((res) => {
                    this.setTotal(res);
                })
                .catch((error) => console.error('error...', error));
        } else {
            this.setDataReset('CONVAYER');
        }

        //용해탱크,혼합,오일탱크,열수탱크,S-1
        query({
            url: '/selectC101000Monitering_MACHBASE',
            params: {
                jsondata: JSON.stringify({
                    ICA1_START_TIME: this.getSafeValue(this.state['1_WORK_START_TIME']),
                    ICA2_START_TIME: this.getSafeValue(this.state['2_WORK_START_TIME']),
                    ICA3_START_TIME: this.getSafeValue(this.state['3_WORK_START_TIME']),
                    JIDAE_START_TIME: this.getSafeValue(this.state['4_WORK_START_TIME']),
                }),
            },
        })
            .then((res) => {
                res.map((item) => {
                    //용해탱크,혼합,오일탱크,열수탱크,S-1만 실행
                    let _value = Number(item.VALUE);
                    if (_.includes(item.TID, '_Count')) {
                        _value = _value.toFixed(0);
                    } else if (_.includes(item.TID, '_Temp')) {
                        _value *= 0.1;
                        _value = _value.toFixed(1);
                    }
                    this.setState({
                        [item.TID + '_Value']: this.numberFormat(_value),
                        [item.TID + '_Name']: item.SENSORNM,
                        [item.TID + '_TIDNM']: item.TID_NM,
                        [item.TID + '_TIMESTAMP']: item.TIMESTAMP,
                        [item.TID + '_TID']: item.TID,
                    });
                    this.setState({
                        total: res,
                    });
                });
            })
            .catch((error) => console.error('error...', error));

        //테이블 조회
        query({
            url: 'listDepartureStatus',
            params: {
                TAG_NM: '',
                START_DATE: moment().format('YYYY-MM-DD'),
                END_DATE: moment().format('YYYY-MM-DD'),
            },
        }).then((res) => {
            this.setState({
                table: res,
            });
        });
    };

    dataIcaLoad = (DATA, EuqNo) => {
        if (DATA !== undefined) {
            //시간이 있을떄만 쿼리가 실행
            query({
                url: '/selectC101000Monitering_MACHBASE_' + EuqNo + '',
                params: {
                    jsondata: '{"' + EuqNo + '_START_TIME" : "' + DATA + '"} ',
                },
            })
                .then((res) => {
                    this.setTotal(res);
                })
                .catch((error) => console.error('error...', error));
        } else {
            this.setDataReset(EuqNo);
        }
    };

    dataBoxLoad = (TIME1, TIME2, EuqNo) => {
        let DATA = EuqNo === '1' ? 'ICA1_START_TIME' : 'ICA3_START_TIME';
        if (TIME1 !== undefined || TIME2 !== undefined) {
            //시간이 둘 중 하나라도 있을떄만 쿼리가 실행 BOX1 : 1,2 /BOX1 :2,3
            query({
                url: '/selectC101000Monitering_MACHBASE_BOX' + EuqNo + '',
                params: {
                    jsondata:
                        /*  (EuqNo === "1" ? '{"ICA1_START_TIME" : "' : '{"ICA3_START_TIME" : "') +
            TIME1 +
            '","' +
            'ICA2_START_TIME" : "' +
            TIME2 +
            '"} ', */
                        JSON.stringify({
                            [DATA]: this.getSafeValue(TIME1),
                            ICA2_START_TIME: this.getSafeValue(TIME2),
                        }),
                },
            })
                .then((res) => {
                    this.setTotal(res);
                })
                .catch((error) => console.error('error...', error));
        } else {
            this.setDataReset(EuqNo);
        }
    };

    setDataReset = (EuqNo) => {
        //시간 데이터가 없어서 초기화 시켜줌!
        if (EuqNo === 'JIDAE') {
            //지대일때 WEIGHT3 변수로 바꿈
            EuqNo = 'WEIGHT3';
        }
        this.setState({
            [EuqNo + '_Ng_Count_Value']: '',
            [EuqNo + '_Total_Count_Value']: '',
            [EuqNo + '_Lapping_Count_Value']: '',
            [EuqNo + '_Xray_Ng_Count_Value']: '',
        });
    };

    setTotal = (res) => {
        //받아오는 데이터 셋팅
        res.map((item) => {
            let _value = Number(item.VALUE);
            if (_.includes(item.TID, '_Count')) {
                _value = _value.toFixed(0);
            } else if (_.includes(item.TID, '_Temp')) {
                _value *= 0.1;
                _value = _value.toFixed(1);
            }
            this.setState({
                [item.TID + '_Value']: this.numberFormat(_value),
                [item.TID + '_Name']: item.SENSORNM,
                [item.TID + '_TIDNM']: item.TID_NM,
                [item.TID + '_TIMESTAMP']: item.TIMESTAMP,
                [item.TID + '_TID']: item.TID,
            });
            this.setState({
                total: res,
            });
        });
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

        this.dataLoadLoop = setInterval(function () {
            dataLoad();
        }, 10000);
    }

    componentWillUnmount() {
        clearInterval(this.dataLoadLoop);
    }

    showlabel = false;
    paused = true;
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.state.player) {
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
                this.state.player.currentTime > 9.5
            ) {
                this.player.seek(2);
            }
            if (this.state.player.duration === this.state.player.currentTime) {
                this.seek(0);
                this.play();
                this.showlabel = false;
            }
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

    //onclick event 적용시, param을 id 로 두었음.
    showDialog = (value) => (event) => {
        this.setState({
            TAG_NM: value,
            icaImg: 'icaImg',
        });
        this.DialogList.openDialog();
    };

    settingBubble = (Euq) => {
        //데이터에 올렸을때 테이블 표시하기
        this.setState({
            ['bubble' + Euq]: true,
            saveEuqTime: this.state[Euq + '_TIMESTAMP'],
        });

        if (Euq.substring(0, Euq.length - 1) === 'PREPROCESS_MixB_Pasteur_Temp') {
            //   //혼합B,열수탱크,S-1이 같은 데이터로 들어와서 숫자를 부여하였고 데이터를 뿌리기전 EUQ1제거해서 저장
            Euq = Euq.substring(0, Euq.length - 1);
            this.setState({
                saveEuqTime: this.state[Euq + '_TIMESTAMP'],
            });
        }
    };

    resetBubble = (Euq) => {
        //내렸을때 테이블 닫기
        this.setState({
            ['bubble' + Euq]: false,
            saveEuqTime: '',
        });
    };

    getSafeValue = (value) => {
        return !!value ? value.toString() : '';
    };

    getZeroData = (value) => {
        //데이터 없을때는 0으로 뿌려주기
        return !!value ? value.toString() : '0';
    };

    render() {
        var regexp = /\B(?=(\d{3})+(?!\d))/g; //세자리 콤마
        var boxData =
            Number(this.state['ICA2_Total_Count_Value'].replace(',', '')) +
            Number(this.state['ICA3_Total_Count_Value'].replace(',', '')) -
            Number(this.state['ICA3_Xray_Ng_Count_Value'].replace(',', '')); //ICA2+ICA3-XRAY3
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
        const drawIcaTable = (
            <table
                className="blueTable2"
                style={{
                    marginLeft: '120px',
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
                        //loop
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

                            <div className="OP -A" />
                            <div className="OP -B" />
                            <div className="OP -C" />
                            <div className="OP -D" />

                            <div className="_C101000_table2">
                                <table className="blueTable2">
                                    <thead>
                                        <tr>
                                            <th>공정명</th>
                                            <th>제품명</th>
                                            <th>작업자명</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>ICA1</td>
                                            <td>{this.state['1_PROD']}</td>
                                            <td>{this.state['1_USERNAME']}</td>
                                        </tr>

                                        <tr>
                                            <td>ICA2</td>
                                            <td>{this.state['2_PROD']}</td>
                                            <td>{this.state['2_USERNAME']}</td>
                                        </tr>

                                        <tr>
                                            <td>ICA3</td>
                                            <td>{this.state['3_PROD']}</td>
                                            <td>{this.state['3_USERNAME']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div
                                className="OP-VAL-ICA1 labelvalue_2_g"
                                onClick={() => {
                                    this.showDialog('ICA1');
                                }}
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['ICA1_Total_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['ICA1_Total_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">ICA1</div>
                                <div className="valpos">
                                    <div className="sensornm">전체 수량</div>
                                    <div className="val g">
                                        {this.getZeroData(this.state['ICA1_Total_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">불량 수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['ICA1_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleICA1_Total_Count) && drawIcaTable}
                            </div>

                            <div
                                className="OP-VAL-ICA2 labelvalue_2_g"
                                onClick={() => {
                                    this.showDialog('ICA2');
                                }}
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['ICA2_Total_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['ICA2_Total_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">ICA2</div>
                                <div className="valpos">
                                    <div className="sensornm">전체 수량</div>
                                    <div className="val g">
                                        {this.getZeroData(this.state['ICA2_Total_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">불량 수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['ICA2_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleICA2_Total_Count) && drawIcaTable}
                            </div>

                            <div
                                className="OP-VAL-ICA3 labelvalue_2_g"
                                onClick={() => {
                                    this.showDialog('ICA3');
                                }}
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['ICA3_Total_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['ICA3_Total_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">ICA3</div>
                                <div className="valpos">
                                    <div className="sensornm">전체 수량</div>
                                    <div className="val g">
                                        {this.getZeroData(this.state['ICA3_Total_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">불량 수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['ICA3_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleICA3_Total_Count) && drawIcaTable}
                            </div>

                            <div
                                className="OP-VAL-XRAY1 labelvalue_1_r"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['ICA1_Xray_Ng_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['ICA1_Xray_Ng_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">XRAY1</div>
                                <div className="valpos">
                                    <div className="sensornm">NG수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['ICA1_Xray_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleICA1_Xray_Ng_Count) && drawIcaTable}
                            </div>
                            <div
                                className="OP-VAL-XRAY2 labelvalue_1_r"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['ICA2_Xray_Ng_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['ICA2_Xray_Ng_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">XRAY2</div>
                                <div className="valpos">
                                    <div className="sensornm">NG수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['ICA2_Xray_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleICA2_Xray_Ng_Count) && drawIcaTable}
                            </div>
                            <div
                                className="OP-VAL-XRAY3 labelvalue_1_r"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['ICA3_Xray_Ng_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['ICA3_Xray_Ng_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">XRAY3</div>
                                <div className="valpos">
                                    <div className="sensornm">NG수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['ICA3_Xray_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleICA3_Xray_Ng_Count) && drawIcaTable}
                            </div>
                            <div
                                className="OP-VAL-METAL labelvalue_1_r"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['WEIGHT3_Ng_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['WEIGHT3_Ng_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">금속검출기</div>
                                <div className="valpos">
                                    <div className="sensornm">NG수량</div>
                                    <div className="val r">
                                        {this.getZeroData(this.state['WEIGHT3_Ng_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleWEIGHT3_Ng_Count) && drawTable}
                            </div>

                            <div
                                className="OP-VAL-TANK1 labelvalue_2_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['PREPROCESS_Melt_Temp_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['PREPROCESS_Melt_Temp_TID'])
                                    );
                                }}
                            >
                                <div className="name">용해탱크</div>
                                <div className="valpos">
                                    <div className="sensornm">온도</div>
                                    <div className="val g">
                                        {this.getZeroData(this.state['PREPROCESS_Melt_Temp_Value'])}
                                    </div>
                                    <div className="unit">°C</div>
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">무게</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_Melt_Weight_Value']
                                        )}
                                    </div>
                                </div>
                                {Boolean(this.state.bubblePREPROCESS_Melt_Temp) && drawTable}
                            </div>

                            <div
                                className="OP-VAL-TANK2 labelvalue_2_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_TID'] + '1'
                                        )
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_TID'] + '1'
                                        )
                                    );
                                }}
                            >
                                <div className="name">혼합B</div>
                                <div className="valpos">
                                    <div className="sensornm">온도</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_Value']
                                        )}
                                    </div>
                                    <div className="unit">°C</div>
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">무게</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixB_Weight_Value']
                                        )}
                                    </div>
                                </div>
                                {Boolean(this.state['bubblePREPROCESS_MixB_Pasteur_Temp' + '1']) &&
                                    drawTable}
                            </div>

                            <div
                                className="OP-VAL-TANK3 labelvalue_2_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixA_Pasteur_Temp_TID']
                                        )
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixA_Pasteur_Temp_TID']
                                        )
                                    );
                                }}
                            >
                                <div className="name">혼합A</div>
                                <div className="valpos">
                                    <div className="sensornm">온도</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixA_Pasteur_Temp_Value']
                                        )}
                                    </div>
                                    <div className="unit">°C</div>
                                </div>
                                <div className="valpos">
                                    <div className="sensornm">무게</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixA_Weight_Value']
                                        )}
                                    </div>
                                </div>
                                {Boolean(this.state.bubblePREPROCESS_MixA_Pasteur_Temp) &&
                                    drawTable}
                            </div>

                            <div
                                className="OP-VAL-TANK4 labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixA_OilTank_Temp_TID']
                                        )
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixA_OilTank_Temp_TID']
                                        )
                                    );
                                }}
                            >
                                <div className="name">오일탱크</div>
                                <div className="valpos">
                                    <div className="sensornm">온도</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixA_OilTank_Temp_Value']
                                        )}
                                    </div>
                                    <div className="unit">°C</div>
                                </div>
                                {Boolean(this.state.bubblePREPROCESS_MixA_OilTank_Temp) &&
                                    drawTable}
                            </div>

                            <div
                                className="OP-VAL-TANK5 labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_TID'] + '2'
                                        )
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_TID'] + '2'
                                        )
                                    );
                                }}
                            >
                                <div className="name">열수탱크</div>
                                <div className="valpos">
                                    <div className="sensornm">온도</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_Value']
                                        )}
                                    </div>
                                    <div className="unit">°C</div>
                                </div>
                                {Boolean(this.state['bubblePREPROCESS_MixB_Pasteur_Temp' + '2']) &&
                                    drawTable}
                            </div>

                            <div
                                className="OP-VAL-TANK6 labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_TID'] + '3'
                                        )
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_TID'] + '3'
                                        )
                                    );
                                }}
                            >
                                <div className="name">S-1</div>
                                <div className="valpos">
                                    <div className="sensornm">온도</div>
                                    <div className="val g">
                                        {this.getZeroData(
                                            this.state['PREPROCESS_MixB_Pasteur_Temp_Value']
                                        )}
                                    </div>
                                    <div className="unit">°C</div>
                                </div>
                                {Boolean(this.state['bubblePREPROCESS_MixB_Pasteur_Temp' + '3']) &&
                                    drawTable}
                            </div>

                            <div
                                className="OP-VAL-WEIGHT1 labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['WEIGHT3_Total_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['WEIGHT3_Total_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">지대</div>
                                <div className="valpos">
                                    <div className="sensornm">전체수량</div>
                                    <div className="val g">
                                        {this.getZeroData(this.state['WEIGHT3_Total_Count_Value'])}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleWEIGHT3_Total_Count) && drawTable}
                            </div>
                            <div
                                className="OP-VAL-WEIGHT2 labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['WEIGHT1_Total_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['WEIGHT1_Total_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">박스</div>
                                <div className="valpos">
                                    <div className="sensornm">전체수량</div>
                                    <div className="val g">
                                        {/* {this.getZeroData(this.state["WEIGHT1_Total_Count_Value"])} */}
                                        {Math.ceil(boxData / 2)
                                            .toString()
                                            .replace(regexp, ',')}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleWEIGHT1_Total_Count) && drawTable}
                            </div>
                            <div className="_C101000_table3">
                                <table className="blueTable2">
                                    <thead>
                                        <tr>
                                            <th>순번</th>
                                            <th>설비명</th>
                                            <th>항목명</th>
                                            <th>상한치</th>
                                            <th>하한치</th>
                                            {/*<th>PV</th>*/}
                                            <th>발생시간</th>
                                            <th>조치여부</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {this.state.table.map((res, i) => (
                                            <tr>
                                                <td>{i + 1}</td>
                                                <td>{res.TAG_NM}</td>
                                                <td>{res.HACCP_CHK_NM}</td>
                                                <td>{res.USL}</td>
                                                <td>{res.LSL}</td>
                                                {/*<td>{res.FACODE_VALUE.toFixed(2)}</td>*/}
                                                <td>{res.STD_DT}</td>
                                                <td>{res.IS_PBM}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div
                                className="OP-VAL-WEIGHT3 labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['WEIGHT2_Total_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['WEIGHT2_Total_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">박스</div>
                                <div className="valpos">
                                    <div className="sensornm">전체수량</div>
                                    <div className="val g">
                                        {/* {this.getZeroData(this.state["WEIGHT2_Total_Count_Value"])} */}

                                        {boxData.toString().replace(regexp, ',')}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleWEIGHT2_Total_Count) && drawTable}
                            </div>
                            <div
                                className="OP-VAL-CONVAYER labelvalue_1_g"
                                onMouseOver={() => {
                                    this.settingBubble(
                                        this.getSafeValue(this.state['CONVAYER_Lapping_Count_TID'])
                                    );
                                }}
                                onMouseOut={() => {
                                    this.resetBubble(
                                        this.getSafeValue(this.state['CONVAYER_Lapping_Count_TID'])
                                    );
                                }}
                            >
                                <div className="name">적재</div>
                                <div className="valpos">
                                    <div className="sensornm">랩핑</div>
                                    <div className="val g">
                                        {/* {this.getZeroData(this.state["CONVAYER_Lapping_Count_Value"])} */}

                                        {(boxData + Math.ceil(boxData / 2) - 15)
                                            .toString()
                                            .replace(regexp, ',')}
                                    </div>
                                    <div className="unit">EA</div>
                                </div>
                                {Boolean(this.state.bubbleCONVAYER_Lapping_Count) && drawTable}
                            </div>
                        </Animated>

                        {/*김민정추가*/}
                        <DialogList
                            TAG_NM={
                                this.state.TAG_NM
                            } /*조회 할 key 값을 param 으로 넘김 변수명은 변동 예정*/
                            total={this.state.total}
                            icaImg={this.state.icaImg}
                            onRef={(ref) => (this.DialogList = ref)}
                        />
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(Video1);
