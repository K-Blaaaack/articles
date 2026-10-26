#!/bin/bash
set -e

IP="192.168.31.92"
USER="root"
PASS="calvin"

MANUAL_CMD="raw 0x30 0x30 0x01 0x00"
AUTO_CMD="raw 0x30 0x30 0x01 0x01"
SPEED_CMD_PREFIX="raw 0x30 0x30 0x02 0xff"

detect_lang() {
    local lang="${LANG:-}${LANGUAGE:-}"
    if [[ "$lang" == *zh* || "$lang" == *ZH* || "$lang" == *cn* || "$lang" == *CN* ]]; then
        CURRENT_LANG="zh"
    else
        CURRENT_LANG="en"
    fi
}
detect_lang

_() {
    local key="$1"; shift
    case "$key" in
        test_conn)    [[ "$CURRENT_LANG" == "zh" ]] && echo -n "正在测试 IPMI 连接到 ${IP}... "        || echo -n "Testing IPMI connection to ${IP}... " ;;
        ok)           [[ "$CURRENT_LANG" == "zh" ]] && echo "成功"                                     || echo "OK" ;;
        failed)       [[ "$CURRENT_LANG" == "zh" ]] && echo "失败"                                     || echo "FAILED" ;;
        manual_on)    [[ "$CURRENT_LANG" == "zh" ]] && echo -n "切换到手动风扇控制... "                || echo -n "Switching to manual fan control... " ;;
        auto_on)      [[ "$CURRENT_LANG" == "zh" ]] && echo -n "恢复到自动风扇控制... "                || echo -n "Restoring automatic fan control... " ;;
        done)         [[ "$CURRENT_LANG" == "zh" ]] && echo "完成"                                     || echo "Done" ;;
        speed_err)    [[ "$CURRENT_LANG" == "zh" ]] && echo "错误: 百分比必须在 1-100 之间"            || echo "ERROR: percentage must be 1-100" ;;
        set_speed)    [[ "$CURRENT_LANG" == "zh" ]] && echo -n "设置风扇速度为 $1% ($2)... "          || echo -n "Setting fan speed to $1% ($2)... " ;;
        re_manual)    [[ "$CURRENT_LANG" == "zh" ]] && echo "重新启用手动模式..."                       || echo "Re-enabling manual mode..." ;;
        trap_msg)     [[ "$CURRENT_LANG" == "zh" ]] && echo "检测到中断信号，恢复自动模式并退出..."    || echo "Caught interrupt, restoring auto mode and exiting..." ;;
        exit_msg)     [[ "$CURRENT_LANG" == "zh" ]] && echo "恢复自动模式并退出..."                     || echo "Restoring auto mode and exiting..." ;;
        title)        [[ "$CURRENT_LANG" == "zh" ]] && echo "IPMI 风扇控制 - 交互模式"                  || echo "IPMI Fan Control - Interactive Mode" ;;
        info)        [[ "$CURRENT_LANG" == "zh" ]] && echo "Power By K-Black"                  || echo "Power By K-Black" ;;
        prompt_text)  [[ "$CURRENT_LANG" == "zh" ]] && echo "输入风扇速度 (1-100), 'auto', 'status', 'exit', 'lang zh|en'"     || echo "Enter fan speed (1-100), 'auto', 'status', 'exit', 'lang zh|en'" ;;
        ctrlc_note)   [[ "$CURRENT_LANG" == "zh" ]] && echo "Ctrl+C 恢复自动模式并退出。"              || echo "Ctrl+C restores auto and exits." ;;
        invalid)      [[ "$CURRENT_LANG" == "zh" ]] && echo "无效输入: 请输入 1-100, 'auto', 'status', 'exit', 'lang zh|en'"  || echo "Invalid input: enter 1-100, 'auto', 'status', 'exit', 'lang zh|en'" ;;
        lang_sw)      [[ "$CURRENT_LANG" == "zh" ]] && echo "语言已切换为: 中文"                        || echo "Language switched to: English" ;;
        lang_usage)   [[ "$CURRENT_LANG" == "zh" ]] && echo "用法: lang zh|en    当前语言: ${CURRENT_LANG}" || echo "Usage: lang zh|en    Current: ${CURRENT_LANG}" ;;
        status_header) [[ "$CURRENT_LANG" == "zh" ]] && echo "--- 当前状态 ---"                          || echo "--- Current Status ---" ;;
        status_ip)    [[ "$CURRENT_LANG" == "zh" ]] && echo "IP:    ${IP}"                               || echo "IP:    ${IP}" ;;
        status_user)  [[ "$CURRENT_LANG" == "zh" ]] && echo "用户:  ${USER}"                             || echo "User:  ${USER}" ;;
        status_mode)  [[ "$CURRENT_LANG" == "zh" ]] && echo "模式:  手动"                                || echo "Mode:  manual" ;;
        help_usage)   [[ "$CURRENT_LANG" == "zh" ]] && echo "用法:"                                     || echo "Usage:" ;;
        help_fan)     [[ "$CURRENT_LANG" == "zh" ]] && echo "  fan               按百分比设置速度 (1-100)，自动转换为十六进制" || echo "  fan               set speed by percentage (1-100), converts to hex automatically" ;;
        help_auto)    [[ "$CURRENT_LANG" == "zh" ]] && echo "  auto              恢复自动风扇控制"      || echo "  auto              restore automatic fan control" ;;
        help_status)  [[ "$CURRENT_LANG" == "zh" ]] && echo "  status            显示当前设置"          || echo "  status            show current settings" ;;
        help_lang)    [[ "$CURRENT_LANG" == "zh" ]] && echo "  lang zh|en        切换语言"               || echo "  lang zh|en        switch language" ;;
        help_exit)    [[ "$CURRENT_LANG" == "zh" ]] && echo "  exit / quit / q   退出脚本"             || echo "  exit / quit / q   exit script" ;;
        separator)    echo "===================================" ;;
    esac
}

ipmi() {
    ipmitool -I lanplus -H "$IP" -U "$USER" -P "$PASS" "$@"
}

pct2hex() {
    local pct=$1
    local hex
    hex=$(printf '%x' "$pct")
    if (( pct < 16 )); then
        echo "0x0${hex}"
    else
        echo "0x${hex}"
    fi
}

hex2pct() {
    local hex=$1
    printf '%d' "$hex"
}

test_conn() {
    _ test_conn
    if ipmi mc info &>/dev/null; then
        _ ok
    else
        _ failed
        exit 1
    fi
}

set_manual() {
    _ manual_on
    ipmi $MANUAL_CMD
    _ done
}

set_auto() {
    _ auto_on
    ipmi $AUTO_CMD
    _ done
}

set_speed() {
    local pct=$1
    if (( pct < 1 || pct > 100 )); then
        _ speed_err
        return 1
    fi
    local hex
    hex=$(pct2hex "$pct")
    _ set_speed "$pct" "$hex"
    ipmi $SPEED_CMD_PREFIX "$hex"
    _ done
}

cmd_status() {
    _ status_header
    _ status_ip
    _ status_user
    _ status_mode
}

cmd_help() {
    _ help_usage
    _ help_fan
    _ help_auto
    _ help_status
    _ help_lang
    _ help_exit
}

toggle_manual_trap() {
    echo ""
    _ trap_msg
    set_auto
    exit 0
}

trap toggle_manual_trap SIGINT SIGTERM

test_conn
set_manual

run_cmd() {
    case "$1" in
        auto)
            set_auto
            ;;
        status)
            cmd_status
            ;;
        help|'?'|h|--help|-h)
            cmd_help
            echo ""
            _ prompt_text
            exit 0
            ;;
        lang|lang\ *)
            arg="${1#lang}"
            arg="${arg# }"
            case "$arg" in
                zh|cn|中文) CURRENT_LANG="zh" ;;
                en)         CURRENT_LANG="en" ;;
            esac
            ;;
        ''|*[!0-9]*)
            _ invalid
            exit 1
            ;;
        *)
            set_speed "$1"
            ;;
    esac
}

if [[ $# -gt 0 ]]; then
    test_conn
    trap toggle_manual_trap SIGINT SIGTERM
    run_cmd "$1"
    exit 0
fi

echo ""
_ title
_ separator
_ info
_ separator
cmd_help
echo ""
_ ctrlc_note
echo ""

while true; do
    read -r -p "fanctl> " input
    case "$input" in
        exit|quit|q)
            _ exit_msg
            set_auto
            exit 0
            ;;
        auto)
            set_auto
            _ re_manual
            set_manual
            ;;
        status)
            cmd_status
            ;;
        help|'?'|h)
            cmd_help
            ;;
        lang|lang\ *)
            arg="${input#lang}"
            arg="${arg# }"
            case "$arg" in
                zh|cn|中文)
                    CURRENT_LANG="zh"
                    _ lang_sw
                    ;;
                en)
                    CURRENT_LANG="en"
                    _ lang_sw
                    ;;
                '')
                    _ lang_usage
                    ;;
                *)
                    _ lang_usage
                    ;;
            esac
            ;;
        ''|*[!0-9]*)
            _ invalid
            ;;
        *)
            set_speed "$input"
            ;;
    esac
done
