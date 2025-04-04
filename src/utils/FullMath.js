/**
 * Chứa các hàm tính toán 512-bit
 * Hỗ trợ phép nhân và chia có thể gặp tràn số trung gian mà không bị mất độ chính xác
 * Xử lý "phantom overflow" - cho phép phép nhân và chia có giá trị trung gian vượt quá 256 bit
 */
export const FullMath = {
  /**
   * Tính floor(a×b÷denominator) với độ chính xác đầy đủ
   * Ném lỗi nếu kết quả tràn uint256 hoặc denominator = 0
   * @param {bigint|number|string} a Số bị nhân
   * @param {bigint|number|string} b Số nhân
   * @param {bigint|number|string} denominator Số chia
   * @returns {bigint} Kết quả 256-bit
   */
  mulDiv: (a, b, denominator) => {
    // Chuyển đổi đầu vào thành BigInt để xử lý số lớn
    const aBn = BigInt(a);
    const bBn = BigInt(b);
    const denominatorBn = BigInt(denominator);

    // Kiểm tra division by zero
    if (denominatorBn === 0n) {
      throw new Error("FullMath: division by zero");
    }

    // Tính tích của a và b
    const product = aBn * bBn;

    // Nếu tích bằng 0, trả về 0
    if (product === 0n) {
      return 0n;
    }

    // Phép chia đơn giản nếu tích vừa trong uint256
    if (product / aBn === bBn) {
      return product / denominatorBn;
    }

    // Đảm bảo denominator != 0 và kết quả không bị tràn
    if (denominatorBn <= product / (2n ** 256n - 1n)) {
      throw new Error("FullMath: multiplication overflow");
    }

    // Phép chia độ chính xác cao
    return product / denominatorBn;
  },

  /**
   * Tính ceil(a×b÷denominator) với độ chính xác đầy đủ
   * Ném lỗi nếu kết quả tràn uint256 hoặc denominator = 0
   * @param {bigint|number|string} a Số bị nhân
   * @param {bigint|number|string} b Số nhân
   * @param {bigint|number|string} denominator Số chia
   * @returns {bigint} Kết quả 256-bit làm tròn lên
   */
  mulDivRoundingUp: (a, b, denominator) => {
    // Chuyển đổi đầu vào thành BigInt
    const aBn = BigInt(a);
    const bBn = BigInt(b);
    const denominatorBn = BigInt(denominator);
    
    // Thực hiện mulDiv
    let result = FullMath.mulDiv(aBn, bBn, denominatorBn);
    
    // Kiểm tra nếu có phần dư, làm tròn lên
    if ((aBn * bBn) % denominatorBn > 0n) {
      result = result + 1n;
    }
    
    return result;
  }
};
