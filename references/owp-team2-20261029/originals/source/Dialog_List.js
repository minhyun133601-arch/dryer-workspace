import React, { Component } from "react";
import { OwpButton, OwpDialog, OwpMessage, OwpSession } from "@wrapper";
import Formsy from "formsy-react";
import * as TGEvent from "@TGEvent/index";
import { mutate, query } from "@owp/api";

/*
    Location    : 실시간 공정현황>3D 영상 > 팝업창
    Deacriptin  : 팝업화면
    FileName    : Dialog_List
    Author      : mj.kim
    Date        : 2020.06.24
    Work        : 3D 세부정보 구현
*/

class DialogReweighing extends Component {
  constructor(props) {
    super(props);
    this.owpDialog = React.createRef();

    this.state = {
      stateDialog: false,
      TID: "",
      TID_NM: "",
      TIMESTAMP: "",
      USL1: "",
      VALUE: "",
      total: [], //받아온 데이터를 한번에 보여주기 위해
      VALUE1: "",
      VALUE2: "",
      VALUE3: "",
      VALUE4: "",
      VALUE5: "",
      VALUE6: "",
      VALUE7: "",
      VALUE8: "",
      VALUE9: "",
      VALUE10: "",
      VALUE11: "",
    };
  }

  componentWillMount() {
    this.props.onRef(this);
  }

  componentWillUnmount() {
    clearInterval(this.dataLoadLoop);
    this.props.onRef(undefined);
  }

  // 창 열기
  openDialog = () => {
    this.setState({
      stateDialog: true,
    });
    setTimeout(() => {
      this.dataLoad(); // 데이터 세부 정보 조회
    }, 2000);
  };

  componentDidMount() {}

  // 데이터 세부 정보 조회
  dataLoad = () => {
    let Arr1 = [];
    let { IcaMapping } = this.state;

    if (this.props.TAG_NM === "" || this.props.TAG_NM === null || this.props.TAG_NM === undefined) {
      this.setState({
        IcaMapping: this.props.total.filter((info) => info.TID_NM == "ICA1"),
      });
      this.setState({
        VALUE1: this.state.IcaMapping[0]["VALUE"],
        VALUE2: this.state.IcaMapping[1]["VALUE"],
        VALUE3: this.state.IcaMapping[2]["VALUE"],
        VALUE4: this.state.IcaMapping[3]["VALUE"],
        VALUE5: this.state.IcaMapping[4]["VALUE"],
        VALUE6: this.state.IcaMapping[5]["VALUE"],
      });
    }

    if (this.props.TAG_NM === "ICA1") {
      this.setState({
        IcaMapping: this.props.total.filter((info) => info.TID_NM == "ICA1"),
      });
      this.setState({
        VALUE1: this.state.IcaMapping[0]["VALUE"],
        VALUE2: this.state.IcaMapping[1]["VALUE"],
        VALUE3: this.state.IcaMapping[2]["VALUE"],
        VALUE4: this.state.IcaMapping[3]["VALUE"],
        VALUE5: this.state.IcaMapping[4]["VALUE"],
        VALUE6: this.state.IcaMapping[5]["VALUE"],
      });
    }
    if (this.props.TAG_NM === "ICA2") {
      this.setState({
        IcaMapping: this.props.total.filter((info) => info.TID_NM == "ICA2"),
      });
      this.setState({
        VALUE1: this.state.IcaMapping[0]["VALUE"],
        VALUE2: this.state.IcaMapping[1]["VALUE"],
        VALUE3: this.state.IcaMapping[2]["VALUE"],
        VALUE4: this.state.IcaMapping[3]["VALUE"],
        VALUE5: this.state.IcaMapping[4]["VALUE"],
        VALUE6: this.state.IcaMapping[5]["VALUE"],
        VALUE7: this.state.IcaMapping[6]["VALUE"],
        VALUE8: this.state.IcaMapping[7]["VALUE"],
        VALUE9: this.state.IcaMapping[8]["VALUE"],
        VALUE10: this.state.IcaMapping[9]["VALUE"],
        VALUE11: this.state.IcaMapping[10]["VALUE"],
      });
    }
    if (this.props.TAG_NM === "ICA3") {
      this.setState({
        IcaMapping: this.props.total.filter((info) => info.TID_NM == "ICA3"),
      });
      this.setState({
        VALUE1: this.state.IcaMapping[0]["VALUE"],
        VALUE2: this.state.IcaMapping[1]["VALUE"],
        VALUE3: this.state.IcaMapping[2]["VALUE"],
        VALUE4: this.state.IcaMapping[3]["VALUE"],
        VALUE5: this.state.IcaMapping[4]["VALUE"],
        VALUE6: this.state.IcaMapping[5]["VALUE"],
        VALUE7: this.state.IcaMapping[6]["VALUE"],
        VALUE8: this.state.IcaMapping[7]["VALUE"],
        VALUE9: this.state.IcaMapping[8]["VALUE"],
        VALUE10: this.state.IcaMapping[9]["VALUE"],
        VALUE11: this.state.IcaMapping[10]["VALUE"],
      });
    }
  };

  // 창 닫기
  closeDialog = () => {
    this.setState({
      stateDialog: false,
      TAG_NM: "", //조회 할 변수 값 상태를 초기화 시켜 준다.
      VALUE1: "",
      VALUE2: "",
      VALUE3: "",
      VALUE4: "",
      VALUE5: "",
      VALUE6: "",
      VALUE7: "",
      VALUE8: "",
      VALUE9: "",
      VALUE10: "",
      VALUE11: "",
    });
    this.owpDialog.handleClose();
    //this.props.clearprops();
  };

  dataLoadLoop = null;
  componentDidMount() {
    // const dataLoad = () => {
    //   this.dataLoad();
    // };
    // this.dataLoadLoop = setInterval(function () {
    //   dataLoad();
    // }, 5000);
  }

  render() {
    return (
      <OwpDialog
        callbackFunction={this.openDialog}
        onOpen={this.state.stateDialog}
        dialogActions={
          <React.Fragment>
            <OwpButton color="primary" variant="contained" onClick={this.closeDialog}>
              닫기
            </OwpButton>
          </React.Fragment>
        }
        width="880px"
        innerRef={(ref) => (this.owpDialog = ref)}
      >
        <React.Fragment>
          {/*디자인 css 는 변동 될 예정 입니다1*/}
          <img id="icaImg" src="/assets/models/ica1.png" />
          <span className="VALUE1">{this.state.VALUE1}</span>
          <span className="VALUE2">{this.state.VALUE1}</span>
          <span className="VALUE3">{this.state.VALUE3}</span>
          <span className="VALUE4">{this.state.VALUE4}</span>
          <span className="VALUE5">{this.state.VALUE5}</span>
          <span className="VALUE6">{this.state.VALUE6}</span>
          <span className="VALUE7">{this.state.VALUE7}</span>
          <span className="VALUE8">{this.state.VALUE8}</span>
          <span className="VALUE9">{this.state.VALUE9}</span>
          <span className="VALUE10">{this.state.VALUE10}</span>
          <span className="VALUE11">{this.state.VALUE11}</span>
        </React.Fragment>
      </OwpDialog>
    );
  }
}

export default DialogReweighing;
