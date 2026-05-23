#!/bin/bash

# ===========================================
# 杏林问诊 - 安装脚本
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Node.js 版本
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        print_info "请安装 Node.js 18.0 或更高版本"
        print_info "访问 https://nodejs.org/ 下载安装"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js 版本过低 (当前: $(node -v))"
        print_info "请安装 Node.js 18.0 或更高版本"
        exit 1
    fi

    print_success "Node.js 版本检查通过: $(node -v)"
}

# 检查 npm 版本
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi

    print_success "npm 版本检查通过: $(npm -v)"
}

# 安装依赖
install_dependencies() {
    print_info "正在安装依赖..."
    
    cd server
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    cd ..
    
    print_success "依赖安装完成"
}

# 创建环境配置文件
setup_env() {
    if [ ! -f ".env" ]; then
        print_info "创建环境配置文件..."
        cp .env.example .env
        print_warning "请编辑 .env 文件配置你的 AI API"
        print_info "配置文件位置: $(pwd)/.env"
    else
        print_info "环境配置文件已存在"
    fi
}

# 创建数据目录
setup_data_dir() {
    if [ ! -d "server/data" ]; then
        print_info "创建数据目录..."
        mkdir -p server/data
    fi
}

# 显示安装完成信息
show_complete_info() {
    echo ""
    echo "==========================================="
    echo -e "${GREEN}安装完成！${NC}"
    echo "==========================================="
    echo ""
    echo "接下来请按照以下步骤操作："
    echo ""
    echo "1. 配置 AI API"
    echo "   编辑 .env 文件，填写你的 API 密钥"
    echo ""
    echo "   示例配置："
    echo "   AI_API_URL=https://api.deepseek.com/v1/chat/completions"
    echo "   AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx"
    echo "   AI_MODEL=deepseek-chat"
    echo ""
    echo "2. 启动服务"
    echo "   cd server"
    echo "   npm start"
    echo ""
    echo "3. 访问系统"
    echo "   打开浏览器访问: http://localhost:3003"
    echo ""
    echo "==========================================="
    echo ""
    echo "支持的 AI 提供商："
    echo "  - DeepSeek (推荐): https://platform.deepseek.com/"
    echo "  - OpenAI: https://platform.openai.com/"
    echo "  - Ollama (本地): https://ollama.ai/"
    echo ""
    echo "更多配置选项请参考 README.md"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "==========================================="
    echo "  🏥 杏林问诊 - 安装程序"
    echo "==========================================="
    echo ""
    
    # 检查环境
    print_info "检查系统环境..."
    check_node
    check_npm
    
    # 安装依赖
    install_dependencies
    
    # 配置环境
    setup_env
    setup_data_dir
    
    # 显示完成信息
    show_complete_info
}

# 运行主函数
main
