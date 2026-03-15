cmake_minimum_required(VERSION 4.2.2)

project(
    playback_timestamp_server
    VERSION 0.0.0
    LANGUAGES C
)

set(CMAKE_C_STANDARD 23)
set(CMAKE_C_STANDARD_REQUIRED ON)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include_directories(src)

add_executable(
    ${PROJECT_NAME}
    "src/main.c"
    "src/mongoose.c"
)

target_link_libraries(
    ${PROJECT_NAME}
    PRIVATE
    ws2_32
)