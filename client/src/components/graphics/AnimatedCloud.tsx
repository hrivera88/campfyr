import { motion, useAnimation } from "framer-motion";
import type { CSSProperties } from "react";

type AnimatedCloudProps = {
    src: string;
    alt?: string;
    delay: number;
    style: CSSProperties;
};

const AnimatedCloud = ({ src, alt = "cloud", delay, style }: AnimatedCloudProps) => (
    <motion.img src={src} alt={alt} initial={{opacity: 0}} animate={{opacity: 1}} transition={{duration: 0.8, delay}} style={{width: 100, height: "auto", position: "absolute", ...style,}} />
);
export default AnimatedCloud;